const urls: Record<string, string> = {
  facebook: 'http://localhost:3001',
  google: 'http://localhost:3002',
  ramzor: 'http://localhost:3003',
  klaviyo: 'http://localhost:3004',
};

export const providers = Object.keys(urls).reduce((acc, provider) => {
  acc[urls[provider]] = provider;
  return acc;
}, {} as Record<string, string>);

export default urls;
