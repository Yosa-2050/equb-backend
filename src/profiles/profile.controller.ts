import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/telegram-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@ApiBearerAuth('access-token')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @ApiOperation({
    summary: 'Get the current user profile and savings stats',
  })
  @Get()
  getProfile(@CurrentUser() user: AuthUser) {
    return this.profileService.getProfile(user.id);
  }

  @ApiOperation({ summary: "Edit the current user's profile" })
  @Patch()
  updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUser) {
    return this.profileService.updateProfile(user.id, dto);
  }
}
