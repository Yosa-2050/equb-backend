import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}
