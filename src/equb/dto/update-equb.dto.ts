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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EqubFrequency, PaymentCollector } from '../entities/equb.entity';

export class UpdateEqubDto {
  @ApiPropertyOptional({ example: 'Family Equb' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 1500 })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  monthlyAmount?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsInt()
  @Min(1)
  @IsOptional()
  durationMonths?: number;

  @ApiPropertyOptional({ example: 12000 })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  totalAmount?: number;

  @ApiPropertyOptional({ enum: EqubFrequency })
  @IsEnum(EqubFrequency)
  @IsOptional()
  frequency?: EqubFrequency;

  @ApiPropertyOptional({ example: 10 })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxMembers?: number;

  @ApiPropertyOptional({ example: '08:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'reminderTime must be in HH:mm 24h format',
  })
  @IsOptional()
  reminderTime?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  reminderDayOfWeek?: number;

  @ApiPropertyOptional({ example: 28 })
  @IsInt()
  @Min(1)
  @Max(30)
  @IsOptional()
  reminderDayOfMonth?: number;

  @ApiPropertyOptional({ enum: PaymentCollector })
  @IsEnum(PaymentCollector)
  @IsOptional()
  collector?: PaymentCollector;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}
