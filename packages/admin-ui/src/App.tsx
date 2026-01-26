import { Routes, Route, Navigate } from 'react-router';
import { useAuth } from './hooks/use-auth';

// Auth routes
import { LoginPage } from './routes/auth/login';
import { SignupPage } from './routes/auth/signup';
import { ForgotPasswordPage } from './routes/auth/forgot-password';
import { InviteAcceptPage } from './routes/auth/invite-accept';

// Dashboard routes
import { DashboardLayout } from './routes/dashboard/layout';
import { DashboardHome } from './routes/dashboard/home';
import { TeamsPage } from './routes/dashboard/teams';
import { NewTeamPage } from './routes/dashboard/teams/new';
import { TeamOverview } from './routes/dashboard/teams/[teamId]';
import { TeamSettings } from './routes/dashboard/teams/[teamId]/settings';
import { TeamMembers } from './routes/dashboard/teams/[teamId]/members';
import { TeamProjects } from './routes/dashboard/teams/[teamId]/projects';
import { NewProjectPage } from './routes/dashboard/teams/[teamId]/projects/new';
import { TeamDeployments } from './routes/dashboard/teams/[teamId]/deployments';
import { TeamObservability } from './routes/dashboard/teams/[teamId]/observability';
import { ProjectOverview } from './routes/dashboard/projects/[projectId]';
import { ProjectSettings } from './routes/dashboard/projects/[projectId]/settings';
import { ProjectEnvVars } from './routes/dashboard/projects/[projectId]/env-vars';
import { DeploymentsPage } from './routes/dashboard/projects/[projectId]/deployments';
import { NewDeploymentPage } from './routes/dashboard/projects/[projectId]/deployments/new';
import { DeploymentDetail } from './routes/dashboard/projects/[projectId]/deployments/[deploymentId]';
import { BuildsPage } from './routes/dashboard/projects/[projectId]/deployments/[deploymentId]/builds';
import { BuildLogs } from './routes/dashboard/projects/[projectId]/deployments/[deploymentId]/builds/[buildId]';
import { ObservabilityDashboard } from './routes/dashboard/projects/[projectId]/observability';
import { TracesPage } from './routes/dashboard/projects/[projectId]/observability/traces';
import { LogsPage } from './routes/dashboard/projects/[projectId]/observability/logs';
import { MetricsPage } from './routes/dashboard/projects/[projectId]/observability/metrics';
import { UserSettings } from './routes/dashboard/settings';
import { NotFoundPage } from './routes/not-found';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface1">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent1" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface1">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent1" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        }
      />
      <Route path="/invite/:inviteId" element={<InviteAcceptPage />} />

      {/* Protected dashboard routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="teams/new" element={<NewTeamPage />} />
        <Route path="teams/:teamId" element={<TeamOverview />} />
        <Route path="teams/:teamId/settings" element={<TeamSettings />} />
        <Route path="teams/:teamId/members" element={<TeamMembers />} />
        <Route path="teams/:teamId/projects" element={<TeamProjects />} />
        <Route path="teams/:teamId/projects/new" element={<NewProjectPage />} />
        <Route path="teams/:teamId/deployments" element={<TeamDeployments />} />
        <Route path="teams/:teamId/observability" element={<TeamObservability />} />
        <Route path="projects/:projectId" element={<ProjectOverview />} />
        <Route path="projects/:projectId/settings" element={<ProjectSettings />} />
        <Route path="projects/:projectId/env-vars" element={<ProjectEnvVars />} />
        <Route path="projects/:projectId/deployments" element={<DeploymentsPage />} />
        <Route path="projects/:projectId/deployments/new" element={<NewDeploymentPage />} />
        <Route path="projects/:projectId/deployments/:deploymentId" element={<DeploymentDetail />} />
        <Route path="projects/:projectId/deployments/:deploymentId/builds" element={<BuildsPage />} />
        <Route path="projects/:projectId/deployments/:deploymentId/builds/:buildId" element={<BuildLogs />} />
        <Route path="projects/:projectId/observability" element={<ObservabilityDashboard />} />
        <Route path="projects/:projectId/observability/traces" element={<TracesPage />} />
        <Route path="projects/:projectId/observability/logs" element={<LogsPage />} />
        <Route path="projects/:projectId/observability/metrics" element={<MetricsPage />} />
        <Route path="settings" element={<UserSettings />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
