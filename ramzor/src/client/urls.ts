const urls: Record<string, string> = {
  facebook: 'http://localhost:3031',
  google: 'http://localhost:3032',
  // ramzor: 'http://localhost:3033',
  klaviyo: 'http://localhost:3034',
};

export const providers = Object.keys(urls).reduce(
  (acc, provider) => {
    acc[urls[provider]] = provider;
    return acc;
  },
  {} as Record<string, string>
);

export default urls;
