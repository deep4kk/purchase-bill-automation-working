import { useState } from "react";
import { format } from "date-fns";
import { useListAuditLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<string>("all");
  const limit = 20;

  const { data, isLoading } = useListAuditLogs({
    page,
    limit,
    action: action === "all" ? undefined : action
  });

  return (
    <div className="p-8 space-y-6 bg-background min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground mt-1">Immutable record of all system activities.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="flex gap-2 w-full sm:w-auto">
              <Select value={action} onValueChange={(val: string) => { setAction(val); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="invoice_upload">Invoice Upload</SelectItem>
                  <SelectItem value="invoice_extract">Invoice Extracted</SelectItem>
                  <SelectItem value="invoice_approve">Invoice Approved</SelectItem>
                  <SelectItem value="erp_push">ERP Push</SelectItem>
                  <SelectItem value="reconciliation_run">Reconciliation Run</SelectItem>
                  <SelectItem value="user_update">User Updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No audit logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/30 text-sm">
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell className="font-medium">{log.userName}</TableCell>
                      <TableCell>
                        <span className="bg-muted px-2 py-1 rounded text-xs font-medium">
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{log.resourceType}</div>
                        {log.resourceId && <div className="text-xs text-muted-foreground font-mono">{log.resourceId.substring(0,8)}...</div>}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-muted-foreground">
                        {log.details || '-'}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-muted-foreground">
                        {log.ipAddress || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {data && data.total > limit && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, data.total)} of {data.total}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page * limit >= data.total} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
