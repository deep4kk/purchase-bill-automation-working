import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/app-layout";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Dashboard from "@/pages/dashboard";
import InvoicesList from "@/pages/invoices/index";
import InvoiceUpload from "@/pages/invoices/upload";
import InvoiceReview from "@/pages/invoices/[id]";
import SuppliersList from "@/pages/suppliers/index";
import ItemsList from "@/pages/items/index";
import Gstr2bList from "@/pages/gstr2b/index";
import Reconciliation from "@/pages/reconciliation/index";
import ErpSettings from "@/pages/erp-settings/index";
import AuditLogs from "@/pages/audit-logs/index";
import UsersList from "@/pages/users/index";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: any }) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/invoices"><ProtectedRoute component={InvoicesList} /></Route>
      <Route path="/invoices/upload"><ProtectedRoute component={InvoiceUpload} /></Route>
      <Route path="/invoices/:id"><ProtectedRoute component={InvoiceReview} /></Route>
      <Route path="/suppliers"><ProtectedRoute component={SuppliersList} /></Route>
      <Route path="/items"><ProtectedRoute component={ItemsList} /></Route>
      <Route path="/gstr2b"><ProtectedRoute component={Gstr2bList} /></Route>
      <Route path="/reconciliation"><ProtectedRoute component={Reconciliation} /></Route>
      <Route path="/erp-settings"><ProtectedRoute component={ErpSettings} /></Route>
      <Route path="/audit-logs"><ProtectedRoute component={AuditLogs} /></Route>
      <Route path="/users"><ProtectedRoute component={UsersList} /></Route>
      
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
