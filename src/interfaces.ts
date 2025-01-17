import { Scenario } from 'automation/automation';
import { Protocol } from 'puppeteer';

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
  browserArgs?: string[];
  output: OutputType;
  preloadFilePath?: string;
  cookies?: Protocol.Network.CookieParam[];
  scenarios?: Scenario[];
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
