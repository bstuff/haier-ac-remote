import { API } from 'homebridge';

import { HapHaierAC } from './haier';

// eslint-disable-next-line import/no-default-export
export default (api: API) => {
  api.registerAccessory('HaierAC', HapHaierAC);
};
