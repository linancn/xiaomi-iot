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
  temperature: number | null;
  humidity: number | null;
  acOn: number | null;
  setTemperature: number | null;
  currentTemperature: number | null;
};

export type DashboardTimeWindow = {
  hours: number;
  bucketMinutes: number;
  start: string;
  end: string;
  timeZone: string;
};

export type ControlThresholds = {
  stopTemperature: number;
  startTemperature: number;
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
  lastChanged: string | null;
  temperature: number | null;
  humidity: number | null;
  battery: number | null;
  rssi: number | null;
  acPower: boolean | null;
  hvacMode: string | null;
  setTemperature: number | null;
  currentTemperature: number | null;
  fanMode: string | null;
  swingMode: string | null;
  temperatureUnit: string | null;
  humidityUnit: string | null;
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
  minTemperature: number | null;
  maxTemperature: number | null;
  averageTemperature: number | null;
  sampleCount: number;
  acRuntimePercent: number | null;
};

export type DashboardData = {
  generatedAt: string;
  dataSource: "database" | "demo";
  databaseStatus: DatabaseStatus;
  timeWindow: DashboardTimeWindow;
  thresholds: ControlThresholds;
  summary: DashboardSummary;
  series: TelemetryPoint[];
  devices: DashboardDevice[];
  automations: AutomationEvent[];
};
