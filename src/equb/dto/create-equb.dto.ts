import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEqubDto {
  @ApiProperty({ example: 'Family Equb', description: 'Name of the equb' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 1000, description: 'Contribution amount in ETB' })
  @IsNumber()
  @IsPositive()
  monthlyAmount!: number;

  @ApiProperty({ example: 12, description: 'Number of contribution months' })
  @IsInt()
  @Min(1)
  durationMonths!: number;

  @ApiProperty({ example: 12000, description: 'Total amount of the equb' })
  @IsNumber()
  @IsPositive()
  totalAmount!: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ example: 'Monthly rotating savings group' })
  @IsString()
  @IsOptional()
  description?: string;
}
