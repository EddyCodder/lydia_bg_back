/**
 * LYD-3: sanitiza y mapea el export de leads/contactos de Kommo (CRM que Lydia
 * reemplaza) contra el modelo actual de lydia_bg_back (Chat/Contact/Agent,
 * schema CRM-12). Solo analisis y limpieza -- no escribe en ninguna base de
 * datos. La carga real espera la version final del export (LYD-3 trabaja
 * sobre la provisional del 2026-09-16).
 *
 * Uso:
 *   npx tsx scripts/kommo/clean-contacts.ts --input <ruta-al-xlsx>
 *   npx tsx scripts/kommo/clean-contacts.ts   (usa ./kommo_export_contacts.xlsx si existe)
 *
 * Salida (todas gitignored, ver .gitignore): tres CSV junto al input:
 *   <input>.limpio.csv      -- filas importables, columnas mapeadas
 *   <input>.revisar.csv     -- de las importables, solo las que quedan con
 *                               algun flag (ver FLAGS) para revision manual
 *   <input>.descartadas.csv -- filas SIN_LEAD (decision del negocio, LYD-3:
 *                               no se cargan) -- se guardan aparte, no se
 *                               pierden silenciosamente
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

// Columnas que sí tienen datos pero todavía no tienen destino en el modelo
// actual (Chat/Contact/Agent) ni en lo que define LYD-1 para leads/pipeline.
// Se conservan en el CSV limpio para no perderlas, marcadas como pendientes.
const PENDING_MAPPING_COLUMNS = ['Etiquetas', 'Nota 1', 'Nota 2', 'Nota 3', 'Nota 4', 'Nota 5'] as const;

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

interface CleanRow {
  id: string;
  nombre: string;
  remoteJid: string;
  telefonoPais: string;
  leadId: string;
  usuarioResponsable: string;
  agentId: string;
  agentNombre: string;
  modificadoPor: string;
  fechaCreacion: string;
  fechaModificacion: string;
  etiquetas: string;
  notas: string;
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

function extractLeadId(value: string | undefined): string {
  if (!value) return '';
  const m = value.match(/Lead #(\d+)/);
  return m ? m[1] : '';
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
    const leadId = extractLeadId(row['Leads']);

    let remoteJid = '';
    let telefonoPais = '';
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
      } else {
        remoteJid = `${parsed.number.replace('+', '')}@s.whatsapp.net`;
        telefonoPais = parsed.country || '';
        if (telefonoPais !== 'PE') {
          flags.push('TELEFONO_NO_PERU');
        }
      }
    }

    if (!nombre) {
      flags.push('NOMBRE_VACIO');
    } else if (/^\d+$/.test(nombre)) {
      flags.push('NOMBRE_NUMERICO');
    }

    if (!leadId) {
      flags.push('SIN_LEAD');
    }

    if (nombre && usuarioResponsable && nombre.toLowerCase() === usuarioResponsable.toLowerCase()) {
      flags.push('NOMBRE_IGUAL_RESPONSABLE');
    }

    const agent = resolveAgent(usuarioResponsable);
    if (usuarioResponsable && !agent) {
      flags.push('SIN_MAPEO_AGENTE');
    }

    for (const f of flags) {
      flagCounts[f] = (flagCounts[f] || 0) + 1;
    }

    const notas = PENDING_MAPPING_COLUMNS.filter((c) => c.startsWith('Nota'))
      .map((c) => (row[c] || '').trim())
      .filter(Boolean)
      .join(' | ');

    cleaned.push({
      id: row['ID'],
      nombre,
      remoteJid,
      telefonoPais,
      leadId,
      usuarioResponsable,
      agentId: agent?.id || '',
      agentNombre: agent?.nombre || '',
      modificadoPor,
      fechaCreacion: parseKommoDate(row['Fecha de Creación']),
      fechaModificacion: parseKommoDate(row['Fecha de Modificación']),
      etiquetas: (row['Etiquetas'] || '').trim(),
      notas,
      flags: flags.join(';'),
    });
  }

  // Decision del negocio (LYD-3): las filas sin lead vinculado no se cargan
  // (varias son claramente spam/basura, y sin lead no hay con que
  // contrastarlas). Se separan en su propio CSV en vez de borrarlas sin
  // dejar rastro.
  const descartadas = cleaned.filter((r) => r.flags.includes('SIN_LEAD'));
  const importables = cleaned.filter((r) => !r.flags.includes('SIN_LEAD'));

  const outBase = inputPath.replace(/\.xlsx$/i, '');
  const cleanedPath = `${outBase}.limpio.csv`;
  const reviewPath = `${outBase}.revisar.csv`;
  const discardedPath = `${outBase}.descartadas.csv`;

  writeCsv(cleanedPath, importables);
  writeCsv(
    reviewPath,
    importables.filter((r) => r.flags),
  );
  writeCsv(discardedPath, descartadas);

  console.log(`Filas procesadas: ${rows.length}`);
  console.log(`Descartadas (SIN_LEAD, no se cargan): ${descartadas.length}`);
  console.log(`Columnas descartadas (siempre/casi siempre vacias, sin info nueva): ${DROPPED_COLUMNS.length}`);
  console.log(`Columnas sin destino en el modelo actual, conservadas igual: ${PENDING_MAPPING_COLUMNS.join(', ')}`);
  console.log('\nFlags (una fila puede tener mas de uno):');
  for (const [flag, count] of Object.entries(flagCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${flag.padEnd(24)} ${count}`);
  }
  const conAgente = importables.filter((r) => r.agentId).length;
  console.log(`\nUsuario responsable resuelto contra Agent real: ${conAgente}/${importables.length} filas importables`);
  console.log('(AGENT_MAP en este script -- los 5 valores de Kommo con dato quedan mapeados)');
  console.log(`\nEscrito: ${cleanedPath} (${importables.length} filas)`);
  console.log(`Escrito: ${reviewPath} (${importables.filter((r) => r.flags).length} filas para revision manual)`);
  console.log(`Escrito: ${discardedPath} (${descartadas.length} filas, no se cargan)`);
}

function writeCsv(filePath: string, rows: CleanRow[]) {
  if (rows.length === 0) {
    fs.writeFileSync(filePath, '');
    return;
  }
  const headers = Object.keys(rows[0]) as (keyof CleanRow)[];
  // Estos CSV se abren a mano en Excel para revisar filas flageadas: un valor
  // que empiece con = + - @ (ej. un telefono pegado en una Nota) se
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
