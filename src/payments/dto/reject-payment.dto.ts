import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectPaymentDto {
  @ApiPropertyOptional({ example: 'Receipt image is not clear' })
  @IsString()
  @IsOptional()
  reason?: string;
}
