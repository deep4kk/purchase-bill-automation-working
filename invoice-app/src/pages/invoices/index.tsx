import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useListInvoices, ListInvoicesStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, SlidersHorizontal, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function InvoicesList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ListInvoicesStatus | "all">("all");
  const limit = 20;

  const { data, isLoading } = useListInvoices(
    { page, limit, search: search || undefined, status: status === "all" ? undefined : status },
    {
      query: {
        refetchInterval: (query) => {
          const invoices = (query.state.data as { data?: Array<{ status: string }> } | undefined)?.data ?? [];
          const hasActive = invoices.some((inv) => inv.status === "pending" || inv.status === "extracting");
          return hasActive ? 3000 : false;
        },
      },
    }
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-slate-100 text-slate-800 border-slate-200";
      case "extracting": return "bg-blue-100 text-blue-800 border-blue-200";
      case "extracted": return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "reviewing": return "bg-amber-100 text-amber-800 border-amber-200";
      case "approved": return "bg-green-100 text-green-800 border-green-200";
      case "pushed": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "failed": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="p-8 space-y-6 bg-background min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="text-muted-foreground mt-1">Manage and review extracted purchase invoices.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices by number or supplier..."
                className="pl-8"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Select value={status} onValueChange={(val: any) => { setStatus(val); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="extracting">Extracting</SelectItem>
                  <SelectItem value="extracted">Extracted</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pushed">Pushed to ERP</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
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
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 ml-auto rounded" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No invoices found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">
                        {invoice.invoiceNumber || <span className="text-muted-foreground italic">Pending</span>}
                        <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[150px]">{invoice.fileName}</div>
                      </TableCell>
                      <TableCell>
                        {invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{invoice.supplierName || '-'}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{invoice.supplierGstin || ''}</div>
                      </TableCell>
                      <TableCell className="font-medium">
                        ₹{invoice.grandTotal?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-normal ${getStatusColor(invoice.status)}`}>
                          {invoice.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/invoices/${invoice.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
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
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page * limit >= data.total}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
