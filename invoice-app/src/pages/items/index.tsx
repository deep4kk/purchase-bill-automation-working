import { useState } from "react";
import { useListItems } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ItemsList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const limit = 20;

  const { data, isLoading } = useListItems({
    page,
    limit,
    search: search || undefined
  });

  return (
    <div className="p-8 space-y-6 bg-background min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Items Master</h1>
          <p className="text-muted-foreground mt-1">Item catalog synced with ERP, used for matching invoice lines.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, HSN, or code..."
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
                  <TableHead>Item Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>ERP Code</TableHead>
                  <TableHead>HSN</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">GST %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No items found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{item.itemCode || '-'}</TableCell>
                      <TableCell className="text-foreground">{item.name}</TableCell>
                      <TableCell>{item.erpItemCode || '-'}</TableCell>
                      <TableCell>{item.hsn || '-'}</TableCell>
                      <TableCell>{item.uom || '-'}</TableCell>
                      <TableCell className="text-right">{item.gstRate !== null ? `${item.gstRate}%` : '-'}</TableCell>
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
