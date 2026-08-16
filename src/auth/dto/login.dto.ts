import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example:
      'query_id=AAHdF6IQAAAAAN0XohDhsOrV&user=%7B%22id%22%3A900000001%7D&auth_date=1700000000&hash=abc...',
    description:
      'The raw initData string Telegram passes to the Mini App (validated with an HMAC-SHA256 signature).',
  })
  @IsString()
  initData: string;
}
