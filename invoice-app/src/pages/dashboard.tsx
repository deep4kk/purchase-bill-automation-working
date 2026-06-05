import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { 
  useGetDashboardStats, 
  useGetRecentInvoices, 
  useGetInvoiceTrend, 
  useGetSupplierStats 
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, CheckCircle, AlertTriangle, Clock, RefreshCcw, UploadCloud } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recentInvoices, isLoading: recentLoading } = useGetRecentInvoices({ limit: 5 });
  const { data: trend, isLoading: trendLoading } = useGetInvoiceTrend();
  const { data: supplierStats, isLoading: supplierStatsLoading } = useGetSupplierStats();

  if (statsLoading || recentLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-background min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {user?.name}. Here is what's happening today.</p>
        </div>
        {(user?.role === "admin" || user?.role === "accounts") && (
          <Link href="/invoices/upload">
            <Button>
              <UploadCloud className="mr-2 h-4 w-4" />
              Upload Invoices
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invoices Processed</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.invoicesProcessed || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Total lifetime invoices</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingReview || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reconciliation Pending</CardTitle>
            <RefreshCcw className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.reconciliationPending || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">GSTR-2B mismatches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ERP Push Success</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.erpPushSuccess || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Successfully synced</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest invoices processed in the system.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentInvoices?.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <Link href={`/invoices/${invoice.id}`}>
                        <p className="font-medium hover:underline cursor-pointer">{invoice.fileName}</p>
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {invoice.supplierName || "Unknown Supplier"} • {invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'MMM dd, yyyy') : 'No Date'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">₹{invoice.grandTotal?.toLocaleString() || "0.00"}</p>
                    <Badge variant={invoice.status === "approved" ? "default" : "secondary"} className="mt-1">
                      {invoice.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))}
              {(!recentInvoices || recentInvoices.length === 0) && (
                <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
                  No recent invoices found.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Extraction and matching accuracy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">GSTR-2B Match Rate</span>
                <span className="font-medium">{stats?.gstrMatchPercent || 0}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500" 
                  style={{ width: `${stats?.gstrMatchPercent || 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Supplier Match Rate</span>
                <span className="font-medium">
                  {supplierStats?.total ? Math.round((supplierStats.matched / supplierStats.total) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary" 
                  style={{ width: `${supplierStats?.total ? (supplierStats.matched / supplierStats.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-right">
                {supplierStats?.matched || 0} / {supplierStats?.total || 0} matched
              </p>
            </div>

            {stats?.erpPushFailed > 0 && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3 text-destructive-foreground">
                <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-destructive">ERP Push Failures</p>
                  <p className="text-xs mt-1 text-destructive/80">
                    {stats.erpPushFailed} invoices failed to push to ERP. Please review them.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
