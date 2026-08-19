import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/telegram-auth.guard';
import { AdminUpdateMemberDto } from './dto/admin-update-member.dto';
import { CreateCollabGroupDto } from './dto/create-collab-group.dto';
import { CreateEqubDto } from './dto/create-equb.dto';
import { NotifyMembersDto } from './dto/notify-members.dto';
import { UpdateEqubDto } from './dto/update-equb.dto';
import { UpdateMyMembershipDto } from './dto/update-my-membership.dto';
import { EqubService } from './equb.service';

@ApiTags('equb')
@ApiBearerAuth('access-token')
@Controller('equb')
export class EqubController {
  constructor(private readonly equbService: EqubService) {}

  @ApiOperation({ summary: 'Create an equb' })
  @Post()
  create(@Body() dto: CreateEqubDto, @CurrentUser() user: AuthUser) {
    return this.equbService.create(dto, user.id);
  }

  @ApiOperation({ summary: 'List equbs the current user belongs to' })
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.equbService.findMine(user.id);
  }

  @ApiOperation({ summary: 'List public equbs' })
  @Get('public')
  findPublic() {
    return this.equbService.findAllPublic();
  }

  @ApiOperation({ summary: 'Look up an equb by invite code' })
  @Get('invite/:code')
  findByInvite(@Param('code') code: string) {
    return this.equbService.findByInviteCode(code);
  }

  @ApiOperation({ summary: 'Get equb detail with members' })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.equbService.findDetail(id, user.id);
  }

  @ApiOperation({ summary: 'Update an equb (admin only)' })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEqubDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.equbService.update(id, dto, user.id);
  }

  @ApiOperation({ summary: 'Close an equb (admin only)' })
  @Post(':id/close')
  close(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.equbService.close(id, user.id);
  }

  @ApiOperation({ summary: 'Delete an equb (admin only)' })
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.equbService.remove(id, user.id);
  }

  @ApiOperation({ summary: 'Join a public equb' })
  @Post(':id/join')
  join(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.equbService.join(id, user.id);
  }

  @ApiOperation({
    summary: 'Join via invite link (public or private)',
    description:
      'Possession of the invite link grants access regardless of the public/private setting.',
  })
  @Post(':id/join/invite')
  joinByInvite(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.equbService.joinByInvite(id, user.id);
  }

  @ApiOperation({ summary: 'List members of an equb' })
  @Get(':id/members')
  getMembers(@Param('id') id: string) {
    return this.equbService.getMembers(id);
  }

  @ApiOperation({
    summary: 'Edit my own membership',
    description:
      'Lets the current member update their display name and payout account details for this equb.',
  })
  @Patch(':id/members/me')
  updateMyMembership(
    @Param('id') id: string,
    @Body() dto: UpdateMyMembershipDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.equbService.updateMyMembership(id, user.id, dto);
  }

  @ApiOperation({
    summary: "Edit a member's info (admin only)",
    description:
      "Lets the admin fill in or correct a member's display name, phone, and payout account details.",
  })
  @Patch(':id/members/:memberId')
  adminUpdateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: AdminUpdateMemberDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.equbService.adminUpdateMember(id, memberId, user.id, dto);
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.equbService.removeMember(id, memberId, user.id);
  }

  @ApiOperation({
    summary: 'Form a collab group (admin only)',
    description:
      'Teams up 2+ members to share one lottery slot. Their contributions must sum exactly to one monthly share.',
  })
  @Post(':id/collab-groups')
  createCollabGroup(
    @Param('id') id: string,
    @Body() dto: CreateCollabGroupDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.equbService.createCollabGroup(id, user.id, dto);
  }

  @ApiOperation({ summary: 'Dissolve a collab group (admin only)' })
  @Delete(':id/collab-groups/:groupId')
  dissolveCollabGroup(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.equbService.dissolveCollabGroup(id, user.id, groupId);
  }

  @ApiOperation({
    summary: 'Send an announcement to every member (admin only)',
    description:
      'Delivers a title + message to every member as an in-app notification and a bot DM.',
  })
  @Post(':id/notify')
  notifyMembers(
    @Param('id') id: string,
    @Body() dto: NotifyMembersDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.equbService.notifyMembers(id, user.id, dto);
  }
}
