import { Link, useLocation } from "wouter";
import { 
  FileText, 
  Users, 
  Package, 
  RefreshCcw, 
  Settings, 
  ShieldCheck, 
  LogOut,
  UploadCloud,
  LayoutDashboard,
  Moon,
  Sun
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "accounts", "purchase_manager", "auditor"] },
    { name: "Invoices", href: "/invoices", icon: FileText, roles: ["admin", "accounts", "purchase_manager", "auditor"] },
    { name: "Upload Invoice", href: "/invoices/upload", icon: UploadCloud, roles: ["admin", "accounts"] },
    { name: "GSTR-2B", href: "/gstr2b", icon: FileText, roles: ["admin", "accounts", "auditor"] },
    { name: "Reconciliation", href: "/reconciliation", icon: RefreshCcw, roles: ["admin", "accounts", "auditor"] },
    { name: "Suppliers", href: "/suppliers", icon: Users, roles: ["admin", "accounts", "purchase_manager", "auditor"] },
    { name: "Items", href: "/items", icon: Package, roles: ["admin", "accounts", "purchase_manager", "auditor"] },
    { name: "ERP Settings", href: "/erp-settings", icon: Settings, roles: ["admin", "accounts"] },
    { name: "Audit Logs", href: "/audit-logs", icon: ShieldCheck, roles: ["admin", "auditor"] },
    { name: "Users", href: "/users", icon: Users, roles: ["admin"] },
  ];

  const filteredNav = navigation.filter(item => user?.role && item.roles.includes(user.role));

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-16 shrink-0 items-center px-6 bg-sidebar-primary text-sidebar-primary-foreground">
        <span className="text-xl font-bold tracking-tight">GST Precision</span>
      </div>
      
      <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
        <nav className="flex-1 space-y-1 px-3">
          {filteredNav.map((item) => {
            const isActive = location === item.href || location.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors"
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground",
                    "mr-3 h-5 w-5 flex-shrink-0"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      
      <div className="flex shrink-0 flex-col border-t border-sidebar-border p-4 gap-2 bg-sidebar">
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-sidebar-foreground">{user?.name}</span>
            <span className="text-xs text-sidebar-foreground/70 truncate w-32">{user?.email}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
        <Button variant="destructive" className="w-full justify-start text-sm h-9" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
