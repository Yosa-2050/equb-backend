import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EqubFrequency } from '../entities/equb.entity';

export class CreateEqubDto {
  @ApiProperty({ example: 'Family Equb', description: 'Name of the equb' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 1000, description: 'Contribution amount in ETB' })
  @IsNumber()
  @IsPositive()
  monthlyAmount!: number;

  @ApiProperty({ example: 12, description: 'Number of contribution periods' })
  @IsInt()
  @Min(1)
  durationMonths!: number;

  @ApiProperty({ example: 12000, description: 'Total amount of the equb' })
  @IsNumber()
  @IsPositive()
  totalAmount!: number;

  @ApiPropertyOptional({
    enum: EqubFrequency,
    default: EqubFrequency.MONTHLY,
    description: 'How often a period (and its payout) advances',
  })
  @IsEnum(EqubFrequency)
  @IsOptional()
  frequency?: EqubFrequency;

  @ApiPropertyOptional({
    example: 10,
    description: 'Member cap. Once reached, joining is closed.',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxMembers?: number;

  @ApiPropertyOptional({
    example: '08:00',
    description: 'Reminder time, 24h HH:mm, Ethiopia local time',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'reminderTime must be in HH:mm 24h format',
  })
  @IsOptional()
  reminderTime?: string;

  @ApiPropertyOptional({
    example: 5,
    description: 'Weekday for reminders (0=Sunday..6=Saturday). Weekly equbs only.',
  })
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  reminderDayOfWeek?: number;

  @ApiPropertyOptional({
    example: 28,
    description: 'Ethiopian calendar day-of-month (1-30) for reminders. Monthly equbs only.',
  })
  @IsInt()
  @Min(1)
  @Max(30)
  @IsOptional()
  reminderDayOfMonth?: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ example: 'Monthly rotating savings group' })
  @IsString()
  @IsOptional()
  description?: string;
}
