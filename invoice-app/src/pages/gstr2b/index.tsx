import { useState, useRef } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useListGstr2bRecords, getListGstr2bRecordsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Upload, FileJson } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Gstr2bList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const limit = 20;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useListGstr2bRecords({
    page,
    limit,
    search: search || undefined
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/gstr2b/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast.success(`Successfully imported ${result.imported} records. Skipped ${result.skipped}.`);
        queryClient.invalidateQueries({ queryKey: getListGstr2bRecordsQueryKey() });
      } else {
        toast.error(result.message || "Failed to import GSTR-2B");
      }
    } catch (err) {
      toast.error("Error connecting to server for import");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-8 space-y-6 bg-background min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">GSTR-2B Data</h1>
          <p className="text-muted-foreground mt-1">Import and view GSTR-2B JSON data from GST portal.</p>
        </div>
        <div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="application/json"
            onChange={handleFileUpload}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Importing..." : "Import JSON"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by supplier or invoice number..."
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
                  <TableHead>Period</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Taxable Val</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">IGST</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <FileJson className="h-8 w-8 opacity-20 mb-2" />
                        <p>No GSTR-2B records found.</p>
                        <p className="text-sm opacity-70">Import JSON file from GST portal to get started.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((record) => (
                    <TableRow key={record.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium whitespace-nowrap">{record.period}</TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{record.supplierName || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{record.supplierGstin}</div>
                      </TableCell>
                      <TableCell className="font-medium">{record.invoiceNumber}</TableCell>
                      <TableCell>{record.invoiceDate ? format(new Date(record.invoiceDate), 'MMM dd, yyyy') : '-'}</TableCell>
                      <TableCell className="text-right">₹{record.taxableValue?.toLocaleString() || "0.00"}</TableCell>
                      <TableCell className="text-right">₹{record.cgst?.toLocaleString() || "0.00"}</TableCell>
                      <TableCell className="text-right">₹{record.sgst?.toLocaleString() || "0.00"}</TableCell>
                      <TableCell className="text-right">₹{record.igst?.toLocaleString() || "0.00"}</TableCell>
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
