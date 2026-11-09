import type { ModelPickerModel } from './model-picker-types';
import { formatModelName } from '@/utils/model';

export const modelDisplayName = (model: ModelPickerModel) => model.name ?? formatModelName(model.id);
