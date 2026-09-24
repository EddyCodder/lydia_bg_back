// LYD-47: modelo y validacion del grafo del bot. Los limites salen de
// WhatsApp Cloud API (botones de respuesta: hasta 3, titulo hasta 20
// caracteres y sin repetir; cuerpo hasta 1024) -- ver docs de Meta,
// "interactive reply buttons". Todo se valida al guardar para que el motor
// (bot.service.ts) pueda asumir un grafo sano.

export type BotNodeType = 'message' | 'question';

export interface BotOption {
  id: string;
  title: string;
}

export interface BotNode {
  id: string;
  type: BotNodeType;
  text: string;
  x: number;
  y: number;
  options?: BotOption[]; // solo en type "question"
}

export interface BotEdge {
  id: string;
  from: string;
  fromOption?: string | null; // id de la opcion (question) o null (message)
  to: string;
}

export interface BotGraph {
  startNodeId: string | null;
  nodes: BotNode[];
  edges: BotEdge[];
}

export const BOT_LIMITS = {
  maxNodes: 30,
  maxOptions: 3,
  optionTitleMax: 20,
  questionTextMax: 1024,
  messageTextMax: 4096,
  idMax: 64,
} as const;

export interface BotValidationResult {
  errors: string[];
  warnings: string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function validateBotGraph(input: unknown): BotValidationResult & { graph?: BotGraph } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(input) || !Array.isArray(input.nodes) || !Array.isArray(input.edges)) {
    return { errors: ['graph debe tener nodes y edges (arrays)'], warnings };
  }

  const nodes: BotNode[] = [];
  const nodeById = new Map<string, BotNode>();

  if (input.nodes.length > BOT_LIMITS.maxNodes) {
    errors.push(`Maximo ${BOT_LIMITS.maxNodes} nodos por flujo`);
  }

  for (const raw of input.nodes.slice(0, BOT_LIMITS.maxNodes + 1)) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id || raw.id.length > BOT_LIMITS.idMax) {
      errors.push('Hay un nodo sin id valido');
      continue;
    }
    if (nodeById.has(raw.id)) {
      errors.push(`Id de nodo repetido: ${raw.id}`);
      continue;
    }
    if (raw.type !== 'message' && raw.type !== 'question') {
      errors.push(`Nodo ${raw.id}: type debe ser "message" o "question"`);
      continue;
    }
    const text = typeof raw.text === 'string' ? raw.text.trim() : '';
    const label = raw.type === 'question' ? 'La pregunta' : 'El mensaje';
    const max = raw.type === 'question' ? BOT_LIMITS.questionTextMax : BOT_LIMITS.messageTextMax;
    if (!text) errors.push(`${label} no puede estar vacio`);
    if (text.length > max) errors.push(`${label} supera ${max} caracteres`);

    const node: BotNode = {
      id: raw.id,
      type: raw.type,
      text,
      x: typeof raw.x === 'number' && Number.isFinite(raw.x) ? raw.x : 0,
      y: typeof raw.y === 'number' && Number.isFinite(raw.y) ? raw.y : 0,
    };

    if (raw.type === 'question') {
      const options: BotOption[] = [];
      const rawOptions = Array.isArray(raw.options) ? raw.options : [];
      if (rawOptions.length < 1 || rawOptions.length > BOT_LIMITS.maxOptions) {
        errors.push(`"${text.slice(0, 30)}": una pregunta necesita de 1 a ${BOT_LIMITS.maxOptions} botones`);
      }
      const titles = new Set<string>();
      const optionIds = new Set<string>();
      for (const o of rawOptions.slice(0, BOT_LIMITS.maxOptions + 1)) {
        if (!isRecord(o) || typeof o.id !== 'string' || !o.id || o.id.length > BOT_LIMITS.idMax) {
          errors.push(`"${text.slice(0, 30)}": hay un boton sin id valido`);
          continue;
        }
        const title = typeof o.title === 'string' ? o.title.trim() : '';
        if (!title) errors.push(`"${text.slice(0, 30)}": un boton no puede estar vacio`);
        if (title.length > BOT_LIMITS.optionTitleMax) {
          errors.push(`Boton "${title}": maximo ${BOT_LIMITS.optionTitleMax} caracteres (limite de WhatsApp)`);
        }
        if (titles.has(title.toLowerCase())) errors.push(`"${text.slice(0, 30)}": botones repetidos ("${title}")`);
        if (optionIds.has(o.id)) errors.push(`"${text.slice(0, 30)}": id de boton repetido`);
        titles.add(title.toLowerCase());
        optionIds.add(o.id);
        options.push({ id: o.id, title });
      }
      node.options = options;
    }

    nodes.push(node);
    nodeById.set(node.id, node);
  }

  const edges: BotEdge[] = [];
  const usedSources = new Set<string>();
  for (const raw of input.edges) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.from !== 'string' || typeof raw.to !== 'string') {
      errors.push('Hay una conexion mal formada');
      continue;
    }
    const from = nodeById.get(raw.from);
    const to = nodeById.get(raw.to);
    if (!from || !to) {
      errors.push('Hay una conexion que apunta a un nodo inexistente');
      continue;
    }
    const fromOption = typeof raw.fromOption === 'string' ? raw.fromOption : null;
    if (from.type === 'question') {
      if (!fromOption || !from.options?.some((o) => o.id === fromOption)) {
        errors.push(`"${from.text.slice(0, 30)}": conexion desde un boton que no existe`);
        continue;
      }
    } else if (fromOption) {
      errors.push(`"${from.text.slice(0, 30)}": un mensaje no tiene botones de salida`);
      continue;
    }
    // Un solo destino por salida (mensaje, o cada boton de una pregunta).
    const sourceKey = `${raw.from}:${fromOption ?? ''}`;
    if (usedSources.has(sourceKey)) {
      errors.push(`"${from.text.slice(0, 30)}": una salida no puede ir a dos destinos`);
      continue;
    }
    usedSources.add(sourceKey);
    edges.push({ id: raw.id, from: raw.from, fromOption, to: raw.to });
  }

  const startNodeId = typeof input.startNodeId === 'string' ? input.startNodeId : null;
  if (nodes.length > 0 && (!startNodeId || !nodeById.has(startNodeId))) {
    errors.push('Falta el nodo inicial del flujo');
  }

  // Sin ciclos: el bot nunca debe poder quedar en un bucle mandando mensajes.
  const next = new Map<string, string[]>();
  for (const e of edges) next.set(e.from, [...(next.get(e.from) ?? []), e.to]);
  const state = new Map<string, 1 | 2>(); // 1 = en curso, 2 = terminado
  let hasCycle = false;
  const visit = (id: string) => {
    if (hasCycle) return;
    state.set(id, 1);
    for (const n of next.get(id) ?? []) {
      if (state.get(n) === 1) {
        hasCycle = true;
        return;
      }
      if (!state.has(n)) visit(n);
    }
    state.set(id, 2);
  };
  for (const n of nodes) if (!state.has(n.id)) visit(n.id);
  if (hasCycle) errors.push('El flujo tiene un ciclo (una conexion vuelve a un paso anterior)');

  // Nodos inalcanzables desde el inicio: advertencia, no error (se pueden dejar en borrador).
  if (startNodeId && nodeById.has(startNodeId)) {
    const reached = new Set<string>();
    const stack = [startNodeId];
    while (stack.length) {
      const id = stack.pop() as string;
      if (reached.has(id)) continue;
      reached.add(id);
      stack.push(...(next.get(id) ?? []));
    }
    const orphans = nodes.filter((n) => !reached.has(n.id));
    if (orphans.length) warnings.push(`${orphans.length} paso(s) no se alcanzan desde el inicio y nunca se enviaran`);
  }

  return { errors, warnings, graph: errors.length ? undefined : { startNodeId, nodes, edges } };
}
