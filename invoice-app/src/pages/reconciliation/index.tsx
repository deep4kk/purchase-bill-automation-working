import { useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListReconciliationRecords, 
  useGetReconciliationSummary,
  useListGstr2bPeriods,
  useRunReconciliation,
  getListReconciliationRecordsQueryKey,
  getGetReconciliationSummaryQueryKey,
  ListReconciliationRecordsStatus
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, RefreshCcw, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Reconciliation() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<string>("");
  const [status, setStatus] = useState<ListReconciliationRecordsStatus | "all">("all");
  const limit = 20;

  const { data: periods } = useListGstr2bPeriods();

  const currentPeriod = period || (periods?.length ? periods[0] : undefined);

  const { data: summary, isLoading: summaryLoading } = useGetReconciliationSummary(
    { period: currentPeriod },
    { query: { enabled: !!currentPeriod, queryKey: getGetReconciliationSummaryQueryKey({ period: currentPeriod }) } }
  );

  const { data: records, isLoading: recordsLoading } = useListReconciliationRecords({
    page,
    limit,
    search: search || undefined,
    period: currentPeriod,
    status: status === "all" ? undefined : status
  }, { query: { enabled: !!currentPeriod } });

  const runReconMutation = useRunReconciliation();

  const handleRunRecon = () => {
    if (!currentPeriod) return;
    
    runReconMutation.mutate(
      { data: { period: currentPeriod } },
      {
        onSuccess: () => {
          toast.success(`Reconciliation complete for ${currentPeriod}`);
          queryClient.invalidateQueries({ queryKey: getGetReconciliationSummaryQueryKey({ period: currentPeriod }) });
          queryClient.invalidateQueries({ queryKey: getListReconciliationRecordsQueryKey() });
        },
        onError: () => {
          toast.error("Failed to run reconciliation");
        }
      }
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "matched": return "bg-green-100 text-green-800 border-green-200";
      case "missing_in_erp": return "bg-red-100 text-red-800 border-red-200";
      case "missing_in_gstr2b": return "bg-orange-100 text-orange-800 border-orange-200";
      case "amount_mismatch": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "gst_mismatch": return "bg-amber-100 text-amber-800 border-amber-200";
      case "duplicate": return "bg-purple-100 text-purple-800 border-purple-200";
      default: return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="p-8 space-y-6 bg-background min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Reconciliation</h1>
          <p className="text-muted-foreground mt-1">Match ERP purchase register with GSTR-2B data.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={currentPeriod} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              {periods?.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleRunRecon} disabled={runReconMutation.isPending || !currentPeriod}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${runReconMutation.isPending ? 'animate-spin' : ''}`} />
            Run Match
          </Button>
        </div>
      </div>

      {!currentPeriod ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border-dashed">
          <RefreshCcw className="h-12 w-12 opacity-20 mb-4" />
          <h3 className="text-lg font-medium text-foreground">No Periods Available</h3>
          <p className="max-w-sm mt-1">Please import GSTR-2B data first to start reconciliation.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Match Accuracy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{summary?.matchPercentage || 0}%</div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden mt-3">
                  <div className="h-full bg-primary" style={{ width: `${summary?.matchPercentage || 0}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {summary?.matched || 0} out of {summary?.total || 0} records matched perfectly
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Perfect Match</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{summary?.matched || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">Missing in ERP</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{summary?.missingInErp || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">Missing in 2B</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{summary?.missingInGstr2b || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">Mismatches</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {(summary?.amountMismatch || 0) + (summary?.gstMismatch || 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search supplier or invoice..."
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
                    <SelectTrigger className="w-full sm:w-[220px]">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="matched">Matched</SelectItem>
                      <SelectItem value="missing_in_erp">Missing in ERP</SelectItem>
                      <SelectItem value="missing_in_gstr2b">Missing in GSTR-2B</SelectItem>
                      <SelectItem value="amount_mismatch">Amount Mismatch</SelectItem>
                      <SelectItem value="gst_mismatch">Tax Mismatch</SelectItem>
                      <SelectItem value="duplicate">Duplicate</SelectItem>
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
                      <TableHead>Status</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="text-right">ERP Value</TableHead>
                      <TableHead className="text-right">2B Value</TableHead>
                      <TableHead className="text-right">ERP Tax</TableHead>
                      <TableHead className="text-right">2B Tax</TableHead>
                      <TableHead className="text-right">Diff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordsLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : records?.data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                          No records found. Run reconciliation to generate matches.
                        </TableCell>
                      </TableRow>
                    ) : (
                      records?.data.map((record) => {
                        const erpTax = (record.erpCgst || 0) + (record.erpSgst || 0) + (record.erpIgst || 0);
                        const gstrTax = (record.gstr2bCgst || 0) + (record.gstr2bSgst || 0) + (record.gstr2bIgst || 0);
                        
                        return (
                          <TableRow key={record.id} className="hover:bg-muted/30 text-sm">
                            <TableCell>
                              <Badge variant="outline" className={`font-normal whitespace-nowrap ${getStatusColor(record.status)}`}>
                                {record.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-foreground truncate max-w-[200px]">{record.supplierName || 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground">{record.supplierGstin}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{record.invoiceNumber}</div>
                              <div className="text-xs text-muted-foreground">{record.invoiceDate ? format(new Date(record.invoiceDate), 'dd/MM/yyyy') : '-'}</div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {record.erpTaxableValue !== null ? `₹${record.erpTaxableValue.toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {record.gstr2bTaxableValue !== null ? `₹${record.gstr2bTaxableValue.toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {erpTax > 0 ? `₹${erpTax.toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {gstrTax > 0 ? `₹${gstrTax.toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${record.mismatchAmount && record.mismatchAmount > 0 ? 'text-destructive' : ''}`}>
                              {record.mismatchAmount ? `₹${Math.abs(record.mismatchAmount).toLocaleString()}` : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {records && records.total > limit && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, records.total)} of {records.total}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page * limit >= records.total} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
