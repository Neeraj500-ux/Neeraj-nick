import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  Activity,
  Bell,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCheck,
  CheckSquare,
  ChevronLeft,
  Command,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  Users,
  Wallet,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { Avatar, Button, Modal } from "../components/ui";
import { Editor } from "../components/Editor";
import {
  canUsePath,
  dashboardPath,
  hasPermission,
} from "../lib/permissions";
import {
  roleAccents,
  roleDescriptions,
  roleLabels,
  type Permission,
} from "../types";
import { useWorkspace } from "../services/workspace";

type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  permission?: Permission;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    label: "OVERVIEW",
    items: [
      {
        label: "Role dashboard",
        path: "/",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "MY WORK",
    items: [
      {
        label: "My tasks",
        path: "/my-tasks",
        icon: CheckSquare,
        permission: "tasks.view",
      },
      {
        label: "My projects",
        path: "/my-projects",
        icon: FolderKanban,
        permission: "projects.view",
      },
      {
        label: "My calendar",
        path: "/calendar",
        icon: CalendarDays,
        permission: "tasks.view",
      },
      {
        label: "My timesheet",
        path: "/time_entries",
        icon: Activity,
        permission: "tasks.view",
      },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      {
        label: "Projects",
        path: "/projects",
        icon: FolderKanban,
        permission: "projects.view",
      },
      {
        label: "Tasks",
        path: "/tasks",
        icon: CheckSquare,
        permission: "tasks.view",
      },
      {
        label: "Clients",
        path: "/clients",
        icon: Building2,
        permission: "projects.view",
      },
      {
        label: "Teams",
        path: "/teams",
        icon: Users,
        permission: "users.view",
      },
      {
        label: "People & roles",
        path: "/people",
        icon: ShieldCheck,
        permission: "users.view",
      },
      {
        label: "Workload",
        path: "/workload",
        icon: ChartNoAxesCombined,
        permission: "reports.view",
      },
    ],
  },
  {
    label: "AGENCY",
    items: [
      {
        label: "Content calendar",
        path: "/content_items",
        icon: CalendarDays,
        permission: "projects.view",
      },
      {
        label: "Requests",
        path: "/requests",
        icon: FileText,
        permission: "requests.create",
      },
      {
        label: "Approvals",
        path: "/approvals",
        icon: CheckCheck,
        permission: "approvals.view",
      },
      {
        label: "Files",
        path: "/files",
        icon: Upload,
        permission: "files.view",
      },
      {
        label: "Documents / SOP",
        path: "/documents",
        icon: FileText,
        permission: "files.view",
      },
      {
        label: "Communication",
        path: "/comments",
        icon: MessageSquare,
        permission: "tasks.view",
      },
    ],
  },
  {
    label: "BUSINESS",
    items: [
      {
        label: "Monthly reports",
        path: "/reports",
        icon: ChartNoAxesCombined,
        permission: "reports.view",
      },
      {
        label: "Attendance",
        path: "/attendance",
        icon: Activity,
        permission: "attendance.view",
      },
      {
        label: "Finance",
        path: "/finance",
        icon: Wallet,
        permission: "finance.view",
      },
      {
        label: "Payroll",
        path: "/payroll",
        icon: Wallet,
        permission: "finance.view",
      },
      {
        label: "Expenses",
        path: "/expenses",
        icon: Wallet,
        permission: "finance.view",
      },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      {
        label: "Notifications",
        path: "/notifications",
        icon: Bell,
        permission: "profile.view",
      },
      {
        label: "Automations",
        path: "/automations",
        icon: Workflow,
        permission: "settings.manage",
      },
      {
        label: "Activity log",
        path: "/activity_logs",
        icon: Activity,
        permission: "audit.view",
      },
      {
        label: "Profile",
        path: "/profile",
        icon: Users,
        permission: "profile.view",
      },
      {
        label: "Settings",
        path: "/settings",
        icon: Settings,
        permission: "settings.view",
      },
    ],
  },
];

const quickCreate: Array<{
  label: string;
  table: string;
  permission: Permission;
}> = [
  {
    label: "New task",
    table: "tasks",
    permission: "tasks.manage",
  },
  {
    label: "New project",
    table: "projects",
    permission: "projects.manage",
  },
  {
    label: "New request",
    table: "requests",
    permission: "requests.create",
  },
  {
    label: "New person",
    table: "employees",
    permission: "users.create",
  },
];

export default function AppShell() {
  const { user, loading, error, logout, data } = useWorkspace();

  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [quick, setQuick] = useState(false);
  const [create, setCreate] = useState("");
  const [command, setCommand] = useState(false);
  const [query, setQuery] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const location = useLocation();

  const quickRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (
        quickRef.current &&
        !quickRef.current.contains(event.target as Node)
      ) {
        setQuick(false);
      }
    };

    document.addEventListener("pointerdown", outside);

    return () => {
      document.removeEventListener("pointerdown", outside);
    };
  }, []);

  useEffect(() => {
    if (!mobile) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    sidebarRef.current
      ?.querySelector<HTMLElement>("a,button")
      ?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      menuRef.current?.focus();
    };
  }, [mobile]);

  useEffect(() => {
    setMobile(false);
    setQuick(false);
    setCommand(false);
    setQuery("");
  }, [location.pathname]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobile(false);
        setQuick(false);
        setCommand(false);
        setCreate("");
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setCommand((value) => !value);
      }
    };

    document.addEventListener("keydown", handler);

    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, []);

  if (loading && !user) {
    return (
      <div className="loading" role="status">
        <span className="loading-mark">
          <span />
        </span>

        <strong>creative-crew</strong>
        <p>Opening your workspace…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const allowed = (item: NavItem) =>
    (!item.permission || hasPermission(user, item.permission)) &&
    (item.path === "/" || canUsePath(user, item.path));

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(allowed),
    }))
    .filter((group) => group.items.length > 0);

  const allItems = visibleGroups.flatMap((group) => group.items);

  const title =
    location.pathname === dashboardPath[user.role]
      ? `${roleLabels[user.role]} dashboard`
      : allItems.find(
            (item) => item.path === location.pathname,
          )?.label || "Workspace";

  const accent = roleAccents[user.role];

  const unread = (data.notifications || []).filter(
    (item) => item.status === "Unread",
  ).length;

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const closeFromNav = (
    event: MouseEvent<HTMLAnchorElement>,
  ) => {
    if (
      event.currentTarget.getAttribute("href") !==
      location.pathname
    ) {
      setMobile(false);
    }
  };

  const filteredCommands = allItems.filter((item) =>
    item.label
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  return (
    <div
      className={`app ca-shell role-accent-${accent} ${
        collapsed ? "collapsed" : ""
      } min-w-0 overflow-x-hidden`}
    >
      <a className="ca-skip" href="#workspace-content">
        Skip to content
      </a>

      {mobile && (
        <button
          className="sidebar-backdrop z-[70]"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}

      <aside
        ref={sidebarRef}
        id="workspace-navigation"
        aria-label="Workspace navigation"
        className={`sidebar z-[90] ${mobile ? "open" : ""}`}
      >
        <button
          className="ca-mobile-close icon-btn"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>

        <Link
          className="brand"
          to={dashboardPath[user.role]}
          onClick={() => setMobile(false)}
        >
          <span className="brand-icon">
            <Layers size={23} />
          </span>

          {(!collapsed || mobile) && (
            <div>
              <strong>creative-crew</strong>
              <small>
                {roleLabels[user.role].toUpperCase()} WORKSPACE
              </small>
            </div>
          )}
        </Link>

        <div className="workspace-switch">
          <span className="workspace-mark">CA</span>

          {(!collapsed || mobile) && (
            <div>
              <strong>Agency workspace</strong>
              <small>Secure Firebase identity</small>
            </div>
          )}

          {(!collapsed || mobile) && (
            <span
              className="live-dot"
              title="Workspace ready"
            />
          )}
        </div>

        <nav aria-label="Main navigation">
          {visibleGroups.map((group) => (
            <section key={group.label}>
              {(!collapsed || mobile) && (
                <h4>{group.label}</h4>
              )}

              {group.items.map((item) => {
                const Icon = item.icon;

                const destination =
                  item.path === "/"
                    ? dashboardPath[user.role]
                    : item.path;

                return (
                  <NavLink
                    end={item.path === "/"}
                    to={destination}
                    title={item.label}
                    key={item.path}
                    onClick={closeFromNav}
                  >
                    <Icon size={18} />

                    {(!collapsed || mobile) && (
                      <span>{item.label}</span>
                    )}

                    {(!collapsed || mobile) &&
                      item.path === "/notifications" &&
                      unread > 0 && <small>{unread}</small>}
                  </NavLink>
                );
              })}
            </section>
          ))}
        </nav>

        <div className="sidebar-footer">
          {(!collapsed || mobile) && (
            <div className="help-card">
              <span className="help-spark">✦</span>
              <strong>Need a hand?</strong>
              <small>Keep your next move clear.</small>

              <a href="mailto:Contact@creativeadhyayan.com">
                Contact support <span>↗</span>
              </a>
            </div>
          )}

          <div className="sidebar-user">
            <Link
              className="profile-button"
              to="/profile"
              onClick={() => setMobile(false)}
              title="Open profile"
            >
              <Avatar name={user.name} role={user.role} />

              {(!collapsed || mobile) && (
                <div>
                  <strong>{user.name}</strong>
                  <small>{roleLabels[user.role]}</small>
                </div>
              )}
            </Link>

            {(!collapsed || mobile) && (
              <button
                className="logout-button"
                type="button"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className="main min-w-0 w-full overflow-x-hidden">
        <header className="workspace-header z-[80]">
          <div className="header-leading">
            <button
              className="icon-btn mobile-menu"
              ref={menuRef}
              aria-expanded={mobile}
              aria-controls="workspace-navigation"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>

            <button
              className="icon-btn collapse-btn"
              aria-label={
                collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
              }
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((value) => !value)}
            >
              <ChevronLeft size={18} />
            </button>

            <div className="breadcrumb">
              <span>Workspace</span>
              <i>/</i>
              <strong>{title}</strong>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="header-search"
              onClick={() => setCommand(true)}
              aria-label="Search workspace"
            >
              <Search size={16} />
              <span>Search anything</span>
              <kbd>⌘ K</kbd>
            </button>

            <div className="quick-create" ref={quickRef}>
              <Button
                onClick={() => setQuick((value) => !value)}
              >
                <Plus size={16} />
                <span>Create</span>
              </Button>

              {quick && (
                <div className="dropdown" role="menu">
                  <small className="ca-dropdown-label">
                    CREATE SOMETHING
                  </small>

                  {quickCreate
                    .filter((item) =>
                      hasPermission(user, item.permission),
                    )
                    .map((item) => (
                      <button
                        key={item.table}
                        type="button"
                        onClick={() => {
                          setCreate(item.table);
                          setQuick(false);
                        }}
                      >
                        {item.label}
                        <Plus size={15} />
                      </button>
                    ))}
                </div>
              )}
            </div>

            <Link
              className="icon-btn notification-bell"
              aria-label={`${unread} unread notifications`}
              to="/notifications"
            >
              <Bell size={19} />
              {unread > 0 && <i />}
            </Link>

            <Link
              className="header-avatar"
              to="/profile"
              aria-label="Open profile"
            >
              <Avatar name={user.name} role={user.role} />
            </Link>
          </div>
        </header>

        <main
          id="workspace-content"
          tabIndex={-1}
          className="!min-w-0 !overflow-x-hidden !pt-[132px] lg:!pt-8"
        >
          <div className="workspace-status">
            <span className="dot" />
            <strong>{roleLabels[user.role]} access</strong>
            <span>·</span>
            <span>{roleDescriptions[user.role]}</span>
          </div>

          {error && (
            <div className="global-error" role="alert">
              {error}
            </div>
          )}

          <Outlet />
        </main>

        <footer>
          <strong>creative-crew</strong>
          <span>
            Built for focused teams. Designed for meaningful work.
          </span>
          <span>© {new Date().getFullYear()}</span>
        </footer>
      </div>

      {create && (
        <Editor
          table={create}
          onClose={() => setCreate("")}
        />
      )}

      {command && (
        <Modal
          title="Find your next step"
          onClose={() => setCommand(false)}
        >
          <div className="search">
            <Search size={18} />

            <input
              autoFocus
              aria-label="Search commands"
              placeholder="Search workspace pages…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="command-results">
            {filteredCommands.map((item) => (
              <Link
                key={item.path}
                to={
                  item.path === "/"
                    ? dashboardPath[user.role]
                    : item.path
                }
                onClick={() => setCommand(false)}
              >
                <Command size={16} />
                {item.label}
              </Link>
            ))}

            {filteredCommands.length === 0 && (
              <p className="ca-search-empty">
                No pages found. Try “tasks”, “files” or “profile”.
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}