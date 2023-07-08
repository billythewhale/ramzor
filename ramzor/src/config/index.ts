import type { ZonesConfig } from '../types';

import facebookConfig from './facebook';
import klaviyoConfig from './klaviyo';
import googleConfig from './google';

const zonesConfig: ZonesConfig = [
  ...facebookConfig.zones,
  ...klaviyoConfig.zones,
  ...googleConfig.zones,
];

export default zonesConfig;
