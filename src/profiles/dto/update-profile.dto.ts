import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserLanguage } from '../../users/entities/user.entity';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Your display name' })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ example: '+251 9xx xxx xxx' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ enum: UserLanguage })
  @IsEnum(UserLanguage)
  @IsOptional()
  language?: UserLanguage;
}
