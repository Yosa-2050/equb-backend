import { EqubFrequency } from '../equb/entities/equb.entity';

export function periodLabel(frequency: EqubFrequency): string {
  switch (frequency) {
    case EqubFrequency.DAILY:
      return 'Day';
    case EqubFrequency.WEEKLY:
      return 'Week';
    case EqubFrequency.MONTHLY:
    default:
      return 'Month';
  }
}
