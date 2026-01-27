/**
 * Team Management Demo
 *
 * Demonstrates team creation, member management, and invitations.
 */

import 'dotenv/config';

import { MastraAdmin, TeamRole } from '@mastra/admin';
import { PostgresAdminStorage } from '@mastra/admin-pg';

// Use valid UUID
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000002';

async function main() {
  console.log('Team Management Demo\n');

  const storage = new PostgresAdminStorage({
    connectionString: process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/mastra_admin',
  });

  const admin = new MastraAdmin({
    licenseKey: 'dev',
    storage,
  });

  await admin.init();

  try {
    // Ensure user exists
    let user = await admin.getUser(DEMO_USER_ID);
    if (!user) {
      await storage.createUser({
        id: DEMO_USER_ID,
        email: 'teams-demo@example.com',
        name: 'Teams Demo User',
        avatarUrl: null,
      });
      console.log('Created demo user\n');
    }

    // Create multiple teams
    const teamSlugs = ['frontend', 'backend', 'ml-ops'];
    const teams = [];

    for (const slug of teamSlugs) {
      try {
        const team = await admin.createTeam(DEMO_USER_ID, {
          name: `${slug.charAt(0).toUpperCase() + slug.slice(1)} Team`,
          slug,
        });
        console.log(`Created team: ${team.name}`);
        teams.push(team);
      } catch (e: unknown) {
        const isPgDuplicate = e && typeof e === 'object' && 'code' in e && e.code === '23505';
        if (isPgDuplicate || (e instanceof Error && e.message.includes('already exists'))) {
          const existing = await admin.listTeams(DEMO_USER_ID);
          const team = existing.data.find(t => t.slug === slug);
          if (team) {
            console.log(`Team exists: ${team.name}`);
            teams.push(team);
          }
        }
      }
    }

    console.log();

    // List all teams for the user
    const allTeams = await admin.listTeams(DEMO_USER_ID);
    console.log(`User has access to ${allTeams.total} team(s):`);
    for (const team of allTeams.data) {
      const members = await admin.getTeamMembers(DEMO_USER_ID, team.id);
      console.log(`  - ${team.name} (${team.slug}): ${members.total} member(s)`);
    }

    console.log();

    // Invite members to first team (using DEVELOPER role instead of MEMBER)
    if (teams[0]) {
      console.log(`Inviting members to ${teams[0].name}...`);
      const emails = ['alice@example.com', 'bob@example.com', 'charlie@example.com'];
      for (const email of emails) {
        try {
          await admin.inviteMember(DEMO_USER_ID, teams[0].id, email, TeamRole.DEVELOPER);
          console.log(`  Invited: ${email}`);
        } catch {
          console.log(`  Already invited: ${email}`);
        }
      }
    }

    console.log('\nTeam demo complete!');
  } finally {
    await admin.shutdown();
  }
}

main().catch(console.error);
