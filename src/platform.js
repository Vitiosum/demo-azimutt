// The "Running on Clever Cloud" panel: only these platform variables are ever shown.
export const PLATFORM_VARS = [
  ['CC_APP_NAME', 'Application'],
  ['APP_ID', 'App ID'],
  ['INSTANCE_NUMBER', 'Instance number'],
  ['INSTANCE_TYPE', 'Instance type'],
  ['CC_PRETTY_INSTANCE_NAME', 'Instance name'],
  ['CC_COMMIT_ID', 'Deployed commit'],
  ['CC_DEPLOYMENT_ID', 'Deployment'],
];

export function platformInfo(env = process.env) {
  return PLATFORM_VARS.map(([name, label]) => {
    let value = env[name] || null;
    if (value && name === 'CC_COMMIT_ID') value = value.slice(0, 7);
    return { name, label, value };
  });
}
