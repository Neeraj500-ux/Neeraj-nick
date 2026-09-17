import React, { Suspense, lazy, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppShell from "./layouts/AppShell";
import { Provider, useWorkspace } from "./services/workspace";
import Login from "./pages/Login";
import AccessDenied from "./pages/AccessDenied";
import RoleDashboard from "./pages/RoleDashboard";
import DirectorDashboard from "./pages/DirectorDashboard";
import People from "./pages/People";
import Profile from "./pages/Profile";
import {
  Calendar,
  Workload,
  Attendance,
  Reports,
  Finance,
  Teams,
  Approvals,
} from "./pages/Operations";
import Settings, { ResetPassword } from "./pages/Settings";
import Files from "./pages/Files";
import { dashboardPath, getDashboardPath, hasPermission } from "./lib/permissions";
import type { Permission, Role } from "./types";
import "./style.css";

const queryClient = new QueryClient();
const Records = lazy(() => import("./pages/Records"));

function LoadingScreen({ label = "Preparing your workspace…" }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="loading-mark"><span /></span>
      <strong>creative-crew</strong>
      <p>{label}</p>
    </div>
  );
}

function Guard({
  children,
  roles,
  permission,
}: {
  children: ReactNode;
  roles?: Role[];
  permission?: Permission;
}) {
  const { user, loading } = useWorkspace();
  const path = useLocation().pathname;

  if (loading && !user) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: path }} />;
  if (roles && !roles.includes(user.role)) return <AccessDenied title="Your role cannot open this dashboard." />;
  if (permission && !hasPermission(user, permission)) return <AccessDenied />;
  return children;
}

function HomeRedirect() {
  const { user, loading } = useWorkspace();
  if (loading && !user) return <LoadingScreen />;
  return user ? <Navigate to={getDashboardPath(user.role)} replace /> : <Navigate to="/login" replace />;
}

class Boundary extends React.Component<{ children: ReactNode }, { error: string }> {
  state = { error: "" };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || "An unexpected error occurred." };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty error-boundary">
        <span className="empty-icon">!</span>
        <h1>Unable to open this page</h1>
        <p>{this.state.error}</p>
        <button className="btn" type="button" onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  }
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<AppShell />}>
          <Route index element={<HomeRedirect />} />
          <Route path="/overview" element={<HomeRedirect />} />
          <Route path="/director" element={<Guard roles={["director"]}><DirectorDashboard /></Guard>} />
          <Route path="/manager" element={<Guard roles={["manager"]}><RoleDashboard /></Guard>} />
          <Route path="/team-lead" element={<Guard roles={["team_lead"]}><RoleDashboard /></Guard>} />
          <Route path="/employee" element={<Guard roles={["employee"]}><RoleDashboard /></Guard>} />
          <Route path="/people" element={<Guard permission="users.view"><People /></Guard>} />
          <Route path="/profile" element={<Guard permission="profile.view"><Profile /></Guard>} />
          <Route path="/my-tasks" element={<Guard permission="tasks.view"><Records fixedTable="tasks" /></Guard>} />
          <Route path="/my-projects" element={<Guard permission="projects.view"><Records fixedTable="projects" /></Guard>} />
          <Route path="/files" element={<Guard permission="files.view"><Files /></Guard>} />
          <Route path="/calendar" element={<Guard permission="tasks.view"><Calendar /></Guard>} />
          <Route path="/workload" element={<Guard permission="reports.view"><Workload /></Guard>} />
          <Route path="/attendance" element={<Guard permission="attendance.view"><Attendance /></Guard>} />
          <Route path="/reports" element={<Guard permission="reports.view"><Reports /></Guard>} />
          <Route path="/finance" element={<Guard permission="finance.view"><Finance /></Guard>} />
          <Route path="/teams" element={<Guard permission="users.view"><Teams /></Guard>} />
          <Route path="/approvals" element={<Guard permission="approvals.view"><Approvals /></Guard>} />
          <Route path="/settings" element={<Guard permission="settings.view"><Settings /></Guard>} />
          {[
            ["projects", "projects.view"],
            ["tasks", "tasks.view"],
            ["clients", "projects.view"],
            ["employees", "users.view"],
            ["content_items", "projects.view"],
            ["requests", "requests.create"],
            ["documents", "files.view"],
            ["comments", "tasks.view"],
            ["payroll", "finance.view"],
            ["expenses", "finance.view"],
            ["invoices", "finance.view"],
            ["notifications", "profile.view"],
            ["automations", "settings.manage"],
            ["activity_logs", "audit.view"],
            ["time_entries", "tasks.view"],
          ].map(([table, permission]) => (
            <Route
              key={table}
              path={`/${table}`}
              element={<Guard permission={permission as Permission}><Records fixedTable={table} /></Guard>}
            />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function NotFound() {
  const { user } = useWorkspace();
  return (
    <div className="empty error-boundary">
      <span className="empty-icon">404</span>
      <h1>Page not found</h1>
      <p>The page moved, or it was never part of this workspace.</p>
      <a className="btn" href={user ? dashboardPath[user.role] : "/login"}>Go to dashboard</a>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Boundary>
      <QueryClientProvider client={queryClient}>
        <Provider>
          <BrowserRouter><AppRoutes /></BrowserRouter>
        </Provider>
      </QueryClientProvider>
    </Boundary>
  </React.StrictMode>,
);
