/**
 * LYD-3/LYD-12: sanitiza y mapea el export de leads/contactos de Kommo (CRM
 * que Lydia reemplaza) contra el modelo Lead real de lydia_bg_back (LYD-8).
 * Solo genera el CSV de carga -- no escribe en ninguna base de datos. La
 * carga real espera la version final del export (este script corre sobre
 * la provisional del 2026-09-16).
 *
 * Uso:
 *   npx tsx scripts/kommo/clean-contacts.ts --input <ruta-al-xlsx>
 *   npx tsx scripts/kommo/clean-contacts.ts   (usa ./kommo_export_contacts.xlsx si existe)
 *
 * Salida (gitignored, ver .gitignore): un solo CSV junto al input,
 * <input>.limpio.csv, con columnas 1:1 contra el modelo Lead (mas
 * remoteJid/telefonoPais/usuarioResponsable/modificadoPor/flags, que son
 * ayuda para el import real o para auditoria, no campos de Lead).
 *
 * xlsx@0.18.5 (npm) tiene advisories de prototype-pollution/ReDoS sin fix
 * publicado en el registro (SheetJS solo lo distribuye por su propio CDN).
 * Riesgo aceptado aqui: uso local, un solo archivo de origen conocido
 * (export propio de Kommo), nunca se ejecuta como parte del runtime de
 * Evolution API ni recibe input de red.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

// Columnas del export que estan siempre (o casi siempre) vacias para
// contactos individuales, o que son puro derivado de otra columna sin
// informacion nueva -- confirmado contra el export provisional (5388 filas,
// 0% de relleno en todas estas salvo lo indicado). Se descartan del todo.
const DROPPED_COLUMNS = [
  'Nombre.1', // = split naive de "Nombre" por el primer espacio, sin info nueva
  'Apellido', // idem
  'Compañía', // 0% -- sin leads corporativos en este export
  'Creado por', // 0.04% (2/5388), no confiable como fuente de asignacion
  'Tarea inmediata', // 0.02% (1/5388)
  'Cargo (contacto)',
  'Correo',
  'E-mail priv.',
  'Otro e-mail',
  'Teléfono oficina directo',
  'Teléfono celular', // vacia: los celulares reales quedaron en "Teléfono oficina"
  'Fax',
  'Teléfono de casa',
  'Otro teléfono',
  'Dirección (compañía)',
  'Página web (compañía)',
] as const;

const NOTE_COLUMNS = ['Nota 1', 'Nota 2', 'Nota 3', 'Nota 4', 'Nota 5'] as const;

// Decision del negocio (LYD-12): "Etiquetas" casi no tiene dato (12/5388
// filas) pero Lead.source es obligatorio -- las filas sin etiqueta quedan
// con este valor fijo en vez de romper la carga.
const DEFAULT_SOURCE = 'Kommo (sin fuente registrada)';

// Lead.source es VARCHAR(50) en el schema -- ninguna Etiquetas del export
// provisional se acerca a este limite (la mas larga son 21 caracteres), pero
// el export final del 18/09 podria traer combinaciones mas largas.
const SOURCE_MAX_LENGTH = 50;

// Mapeo manual de "Usuario responsable" (Kommo) -> Agent real de lydia_bg_back
// (decidido con el negocio, LYD-3). Los valores de Kommo no son logins de
// Lydia: "Mafer" es apodo de una de las dos Maria Fernanda del equipo, y el
// resto son nombres de sede -- cuando una sede tiene mas de un asesora y no
// se puede diferenciar por fila, se usa una asesora de referencia fija.
// Comparacion case-insensitive sobre el valor ya recortado (trim).
const AGENT_MAP: Record<string, { id: string; nombre: string }> = {
  mafer: { id: 'agent_mmaturrano', nombre: 'María Fernanda Maturano Evangelista' },
  bustamante: { id: 'agent_pkasparette', nombre: 'Pierina Kasparette Melgar' },
  // Centro y Cayma: confirmado que son sedes propias, DISTINTAS de
  // "Lince"/"Umacollo". Se resolvieron consultando la tabla `sedes` /
  // `user_sedes` de la base de produccion del SGA (2026-09-17): cada una
  // tiene 2 asesoras activas asignadas y no hay forma de diferenciar por
  // fila de Kommo cual atendio cada contacto, asi que el negocio eligio una
  // de referencia igual que hizo con Bustamante.
  centro: { id: 'agent_cveliz', nombre: 'Cynthia Veliz Fernandini' },
  cayma: { id: 'agent_vrivera', nombre: 'Yoxsana Valentina Rivera Molina' },
  // Miraflores no tiene ninguna asesora activa en el SGA (solo Rosi Lara,
  // inactiva -- coincide con el valor "Rosy" sin match en "Modificado por").
  // El negocio eligio a Maria del Pilar Angles Garcia (admin de esa sede en
  // el SGA, no asesora) como responsable de referencia mientras tanto.
  'brittany miraflores': { id: 'agent_pilar', nombre: 'María del Pilar Angles García' },
};

interface RawRow {
  ID: string;
  Tipo: string;
  Nombre?: string;
  'Fecha de Creación'?: string;
  'Fecha de Modificación'?: string;
  'Modificado por'?: string;
  Etiquetas?: string;
  'Usuario responsable'?: string;
  Leads?: string;
  'Teléfono oficina'?: string;
  'Nota 1'?: string;
  'Nota 2'?: string;
  'Nota 3'?: string;
  'Nota 4'?: string;
  'Nota 5'?: string;
  [key: string]: string | undefined;
}

// Columnas 1:1 contra el modelo Lead (LYD-8 + observations de LYD-12), mas
// unas pocas de apoyo para el import real o auditoria (no son campos de
// Lead): kommoContactId, remoteJid, telefonoPais, usuarioResponsable,
// modificadoPor, flags.
interface CleanRow {
  kommoContactId: string;
  contactName: string;
  phone: string;
  remoteJid: string;
  telefonoPais: string;
  source: string;
  assignedAgentId: string;
  agentNombre: string;
  usuarioResponsable: string;
  modificadoPor: string;
  createdAt: string;
  updatedAt: string;
  observations: string;
  flags: string;
}

function resolveAgent(usuarioResponsable: string): { id: string; nombre: string } | null {
  if (!usuarioResponsable) return null;
  return AGENT_MAP[usuarioResponsable.toLowerCase()] || null;
}

// Kommo exporta fechas como "DD.MM.YYYY HH:mm:ss" en hora de Lima.
function parseKommoDate(value: string | undefined): string {
  if (!value) return '';
  const m = value.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return value; // formato inesperado: se deja crudo para revisar a mano
  const [, dd, mm, yyyy, hh, mi, ss] = m;
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-05:00`;
}

// Los telefonos vienen con comilla inicial (Excel los fuerza a texto, ej.
// "'+51973466667") para no perder el "+" como si fuera formula.
function stripExcelTextQuote(value: string): string {
  return value.startsWith("'") ? value.slice(1) : value;
}

function hasLead(value: string | undefined): boolean {
  return !!value && /Lead #\d+/.test(value);
}

function main() {
  const inputArgIndex = process.argv.indexOf('--input');
  const inputPath =
    inputArgIndex !== -1 && process.argv[inputArgIndex + 1]
      ? process.argv[inputArgIndex + 1]
      : path.resolve(__dirname, '../../kommo_export_contacts.xlsx');

  if (!fs.existsSync(inputPath)) {
    console.error(`No se encontro el archivo de entrada: ${inputPath}`);
    console.error('Pasalo con --input <ruta> o copialo a kommo_export_contacts.xlsx en la raiz del repo.');
    process.exit(1);
  }

  const workbook = XLSX.readFile(inputPath);
  const sheetName = workbook.SheetNames[0];
  const rows: RawRow[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });

  const cleaned: CleanRow[] = [];
  const flagCounts: Record<string, number> = {};

  for (const row of rows) {
    const flags: string[] = [];
    const nombre = (row['Nombre'] || '').trim();
    const usuarioResponsable = (row['Usuario responsable'] || '').trim();
    const modificadoPor = (row['Modificado por'] || '').trim();
    const telefonoRaw = row['Teléfono oficina'] ? stripExcelTextQuote(row['Teléfono oficina'].trim()) : '';
    const kommoContactId = row['ID'];

    let remoteJid = '';
    let telefonoPais = '';
    let phone = '';
    if (!telefonoRaw) {
      flags.push('SIN_TELEFONO');
    } else {
      // defaultCountry solo aplica si telefonoRaw no trae '+' (en el export
      // provisional el 100% de los valores lo trae, pero el export final del
      // 18/09 podria no ser tan consistente).
      const parsed = parsePhoneNumberFromString(telefonoRaw, 'PE');
      if (!parsed || !parsed.isValid()) {
        flags.push('TELEFONO_INVALIDO');
        // Decision del negocio (LYD-3): no descartar estas filas -- se arma
        // un remoteJid "best effort" con los digitos crudos aunque no se
        // pueda validar el numero (ej. le faltan digitos). Puede no
        // corresponder a un WhatsApp real; el flag queda para revisarlo.
        const digits = telefonoRaw.replace(/\D/g, '');
        if (digits) remoteJid = `${digits}@s.whatsapp.net`;
        phone = telefonoRaw;
      } else {
        remoteJid = `${parsed.number.replace('+', '')}@s.whatsapp.net`;
        telefonoPais = parsed.country || '';
        phone = parsed.number;
        if (telefonoPais !== 'PE') {
          flags.push('TELEFONO_NO_PERU');
        }
      }
    }

    // Decision del negocio (LYD-12): sin Nombre, usar el telefono como
    // contactName (Lead.contactName es obligatorio) aunque quede duplicado
    // con Lead.phone. Si tampoco hay telefono (13 filas), usar el ID de
    // Kommo como ultimo recurso -- el negocio no cubrio este caso limite.
    let contactName = nombre;
    if (!nombre) {
      flags.push('NOMBRE_VACIO');
      contactName = phone || `Contacto Kommo #${kommoContactId}`;
    } else if (/^\d+$/.test(nombre)) {
      flags.push('NOMBRE_NUMERICO');
    }

    if (!hasLead(row['Leads'])) {
      flags.push('SIN_LEAD');
    }

    if (nombre && usuarioResponsable && nombre.toLowerCase() === usuarioResponsable.toLowerCase()) {
      flags.push('NOMBRE_IGUAL_RESPONSABLE');
    }

    const agent = resolveAgent(usuarioResponsable);
    if (usuarioResponsable && !agent) {
      flags.push('SIN_MAPEO_AGENTE');
    }

    const rawEtiquetas = (row['Etiquetas'] || '').trim();
    if (!rawEtiquetas) flags.push('SIN_ETIQUETA');
    let source = rawEtiquetas || DEFAULT_SOURCE;
    if (source.length > SOURCE_MAX_LENGTH) {
      flags.push('SOURCE_TRUNCADO');
      source = source.slice(0, SOURCE_MAX_LENGTH);
    }

    for (const f of flags) {
      flagCounts[f] = (flagCounts[f] || 0) + 1;
    }

    const observations = NOTE_COLUMNS.map((c) => (row[c] || '').trim())
      .filter(Boolean)
      .join(' | ');

    cleaned.push({
      kommoContactId,
      contactName,
      phone,
      remoteJid,
      telefonoPais,
      source,
      assignedAgentId: agent?.id || '',
      agentNombre: agent?.nombre || '',
      usuarioResponsable,
      modificadoPor,
      createdAt: parseKommoDate(row['Fecha de Creación']),
      updatedAt: parseKommoDate(row['Fecha de Modificación']),
      observations,
      flags: flags.join(';'),
    });
  }

  // Decision del negocio (LYD-3): las filas sin lead vinculado no se cargan
  // (varias son claramente spam/basura, y sin lead no hay con que
  // contrastarlas).
  const importables = cleaned.filter((r) => !r.flags.includes('SIN_LEAD'));
  const descartadasCount = cleaned.length - importables.length;

  const outBase = inputPath.replace(/\.xlsx$/i, '');
  const cleanedPath = `${outBase}.limpio.csv`;
  writeCsv(cleanedPath, importables);

  console.log(`Filas procesadas: ${rows.length}`);
  console.log(`Descartadas (SIN_LEAD, no se cargan, no quedan en el CSV): ${descartadasCount}`);
  console.log(`Columnas descartadas (siempre/casi siempre vacias, sin info nueva): ${DROPPED_COLUMNS.length}`);
  console.log('\nFlags (una fila puede tener mas de uno, informativos -- ninguno bloquea la carga):');
  for (const [flag, count] of Object.entries(flagCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${flag.padEnd(24)} ${count}`);
  }
  const conAgente = importables.filter((r) => r.assignedAgentId).length;
  const conEtiqueta = importables.filter((r) => r.source !== DEFAULT_SOURCE).length;
  console.log(`\nassignedAgentId resuelto: ${conAgente}/${importables.length} filas`);
  console.log(`source con dato real de Kommo (resto usa el default "${DEFAULT_SOURCE}"): ${conEtiqueta}/${importables.length}`);
  console.log(`\nEscrito: ${cleanedPath} (${importables.length} filas, listo para cargar contra Lead)`);
}

function writeCsv(filePath: string, rows: CleanRow[]) {
  if (rows.length === 0) {
    fs.writeFileSync(filePath, '');
    return;
  }
  const headers = Object.keys(rows[0]) as (keyof CleanRow)[];
  // Este CSV se puede abrir a mano en Excel para auditoria: un valor que
  // empiece con = + - @ (ej. un telefono pegado en una nota) se
  // interpretaria como formula. Se neutraliza con una comilla simple, igual
  // que hace Excel al exportar el telefono original de Kommo.
  const escape = (v: string) => {
    const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(String(r[h]))).join(','))];
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

main();
