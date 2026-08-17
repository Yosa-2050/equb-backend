import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NotifyMembersDto {
  @ApiProperty({ example: 'Lottery starts soon!' })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ example: 'Join us live in the app at 6 PM for this month\'s draw.' })
  @IsString()
  @MinLength(1)
  message!: string;
}
