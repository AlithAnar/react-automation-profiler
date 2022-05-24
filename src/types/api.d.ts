export enum OutputType {
  CHART = 'chart',
  JSON = 'json',
}
export interface Options {
  averageOf: number;
  changeInterval: number;
  includeMount: boolean;
  page: string;
  port: number;
  watch: boolean | string;
  headless: boolean;
  output: OutputType;
}

export type APIOptions = Omit<
  Options,
  'output' | 'watch' | 'changeInterval' | 'port'
>;

export type AutomationLogs = {
  actualDuration: number;
  baseDuration: number;
  commitTime: number;
  id: string;
  interactions: Set<Interaction>;
  phase: string;
  startTime: number;
};

export interface Interaction {
  id: number;
  name: string;
  timestamp: number;
}

export interface AutomationResult {
  logs: AutomationLogs[];
  numberOfInteractions: number;
  id: string;
}

export type IResults = Record<string, AutomationResult[]>;

export class AutomationAPI {
  static run(options: APIOptions): Promise<IResults>;
}
