import { Body, Controller, NotFoundException, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({
    summary: 'Log in with Telegram',
    description:
      'Validates the Telegram WebApp initData signature and returns a JWT. Works inside the Telegram Mini App.',
  })
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.initData);
  }

  @ApiOperation({
    summary: 'Dev login (no Telegram required)',
    description:
      'Returns a JWT for the DEV_TELEGRAM_ID user. Only enabled when DEV_LOGIN=true. Use the returned token with the Authorize button to test protected endpoints.',
  })
  @Public()
  @Post('dev-login')
  devLogin() {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const enabled = this.configService.get<string>('DEV_LOGIN') === 'true';
    if (isProduction || !enabled) {
      throw new NotFoundException();
    }
    return this.authService.devLogin();
  }
}
