import type { Zones } from '@tw/ramzor';

import facebookConfig from './facebook';
import klaviyoConfig from './klaviyo';
import googleConfig from './google';

const zonesConfig: Zones = [
  ...facebookConfig,
  ...klaviyoConfig,
  ...googleConfig,
];

export default zonesConfig;
