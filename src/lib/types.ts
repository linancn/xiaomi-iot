export type DeviceKind =
  | "thermometer"
  | "air_conditioner"
  | "humidity_sensor"
  | "switch"
  | "unknown";

export type DatabaseStatus = "connected" | "not_configured" | "error" | "empty";

export type TelemetryPoint = {
  time: string;
  label: string;
  temperature: number;
  bedroomTemperature: number;
  humidity: number;
  acOn: number;
  setpoint: number;
};

export type DashboardDevice = {
  source: string;
  externalId: string;
  name: string;
  room: string;
  kind: DeviceKind;
  model: string | null;
  status: "online" | "stale" | "offline";
  lastSeen: string | null;
  temperature: number | null;
  humidity: number | null;
  acPower: boolean | null;
  setpoint: number | null;
};

export type AutomationEvent = {
  id: string;
  occurredAt: string;
  room: string;
  triggerMetric: string;
  triggerValue: number;
  threshold: number;
  targetDevice: string;
  action: string;
  result: "success" | "failed" | "pending";
  cooldownMinutes: number;
};

export type DashboardSummary = {
  currentTemperature: number;
  currentHumidity: number;
  acRunning: number;
  todayTriggers: number;
  averageCooldownMinutes: number;
  comfortScore: number;
};

export type DashboardData = {
  generatedAt: string;
  dataSource: "database" | "demo";
  databaseStatus: DatabaseStatus;
  summary: DashboardSummary;
  series: TelemetryPoint[];
  devices: DashboardDevice[];
  automations: AutomationEvent[];
};
