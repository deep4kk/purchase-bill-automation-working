import { useState } from "react";
import { useListSuppliers, getListSuppliersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function SuppliersList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const limit = 20;

  const { data, isLoading } = useListSuppliers({
    page,
    limit,
    search: search || undefined
  });

  return (
    <div className="p-8 space-y-6 bg-background min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Suppliers</h1>
          <p className="text-muted-foreground mt-1">Master list of all suppliers, synced with ERP.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, GSTIN, or code..."
              className="pl-8"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Supplier Name</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>ERP Code</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No suppliers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((supplier) => (
                    <TableRow key={supplier.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">{supplier.name}</TableCell>
                      <TableCell>{supplier.gstin || '-'}</TableCell>
                      <TableCell>{supplier.erpSupplierId || '-'}</TableCell>
                      <TableCell>
                        <div className="text-sm">{supplier.email || '-'}</div>
                        <div className="text-xs text-muted-foreground">{supplier.phone || '-'}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={supplier.isMatched ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-700 border-slate-200"}>
                          {supplier.isMatched ? "Matched" : "Unmatched"}
                        </Badge>
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
