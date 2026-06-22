import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  useGetInvoice, 
  getGetInvoiceQueryKey,
  useUpdateInvoice,
  useExtractInvoice,
  useApproveInvoice,
  usePushInvoiceToErp,
  useListSuppliers,
  useMatchSupplier
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, Save, Trash2, Plus, Zap, Send, AlertTriangle, Eye, Download, X } from "lucide-react";

export default function InvoiceReview() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [remark, setRemark] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const { data: invoice, isLoading } = useGetInvoice(id, { 
    query: { enabled: !!id, queryKey: getGetInvoiceQueryKey(id) } 
  });

  const { data: suppliersData } = useListSuppliers({ limit: 100 }, { query: { enabled: !!id } });

  const updateMutation = useUpdateInvoice();
  const extractMutation = useExtractInvoice();
  const approveMutation = useApproveInvoice();
  const pushMutation = usePushInvoiceToErp();
  const matchMutation = useMatchSupplier();

  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    if (invoice && !isEditing) {
      setFormData({
        invoiceNumber: invoice.invoiceNumber || "",
        invoiceDate: invoice.invoiceDate || "",
        supplierName: invoice.supplierName || "",
        supplierGstin: invoice.supplierGstin || "",
        placeOfSupply: invoice.placeOfSupply || "",
        taxableValue: invoice.taxableValue || 0,
        cgst: invoice.cgst || 0,
        sgst: invoice.sgst || 0,
        igst: invoice.igst || 0,
        grandTotal: invoice.grandTotal || 0,
        items: invoice.items ? [...invoice.items] : []
      });
    }
  }, [invoice, isEditing]);

  const handleStartEdit = () => {
    setRemark("");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setRemark("");
  };

  const handleSave = () => {
    if (!remark.trim()) {
      toast.error("Please enter a remark explaining the changes");
      return;
    }
    updateMutation.mutate(
      { invoiceId: id, data: { ...formData, remark: remark.trim() } },
      {
        onSuccess: () => {
          toast.success("Invoice updated successfully");
          setIsEditing(false);
          setRemark("");
          queryClient.invalidateQueries({ queryKey: getGetInvoiceQueryKey(id) });
        },
        onError: () => toast.error("Failed to update invoice")
      }
    );
  };

  const handleExtract = () => {
    extractMutation.mutate(
      { invoiceId: id },
      {
        onSuccess: () => {
          toast.success("Extraction started");
          queryClient.invalidateQueries({ queryKey: getGetInvoiceQueryKey(id) });
        },
        onError: () => toast.error("Failed to start extraction")
      }
    );
  };

  const handleApprove = () => {
    approveMutation.mutate(
      { invoiceId: id },
      {
        onSuccess: () => {
          toast.success("Invoice approved");
          queryClient.invalidateQueries({ queryKey: getGetInvoiceQueryKey(id) });
        },
        onError: () => toast.error("Failed to approve invoice")
      }
    );
  };

  const handlePush = () => {
    pushMutation.mutate(
      { invoiceId: id },
      {
        onSuccess: () => {
          toast.success("Push to ERP started");
          queryClient.invalidateQueries({ queryKey: getGetInvoiceQueryKey(id) });
        },
        onError: () => toast.error("Failed to push to ERP")
      }
    );
  };

  const handleSupplierMatch = (supplierId: string) => {
    matchMutation.mutate(
      { invoiceId: id, data: { supplierId: supplierId === "none" ? null : supplierId } },
      {
        onSuccess: () => {
          toast.success("Supplier match updated");
          queryClient.invalidateQueries({ queryKey: getGetInvoiceQueryKey(id) });
        },
        onError: () => toast.error("Failed to update supplier match")
      }
    );
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'rate' || field === 'quantity') {
      const q = field === 'quantity' ? Number(value) : Number(newItems[index].quantity || 0);
      const r = field === 'rate' ? Number(value) : Number(newItems[index].rate || 0);
      newItems[index].amount = q * r;
    }
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { id: `new-${Date.now()}`, description: "", quantity: 1, rate: 0, amount: 0, hsn: "", uom: "NOS" }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  if (isLoading || !formData) {
    return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;
  }

  const confidenceColor = 
    !invoice?.confidenceScore ? "bg-slate-100 text-slate-800" :
    invoice.confidenceScore > 85 ? "bg-green-100 text-green-800" :
    invoice.confidenceScore > 60 ? "bg-yellow-100 text-yellow-800" :
    "bg-red-100 text-red-800";

  return (
    <div className="p-8 space-y-6 bg-background min-h-full">
      <div className="flex items-center gap-4">
        <Link href="/invoices">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {invoice?.invoiceNumber || invoice?.fileName}
            </h1>
            <Badge variant="outline">{invoice?.status}</Badge>
            {invoice?.confidenceScore && (
              <Badge className={confidenceColor} variant="outline">
                {invoice.confidenceScore}% Confidence
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Review and process invoice details</p>
        </div>
        
        <div className="ml-auto flex items-center gap-2">
          {invoice?.status === "pending" || invoice?.status === "failed" ? (
            <Button onClick={handleExtract} disabled={extractMutation.isPending}>
              <Zap className="mr-2 h-4 w-4" />
              Extract Data
            </Button>
          ) : null}
          
          {(invoice?.status === "reviewing" || invoice?.status === "extracted") && !isEditing ? (
            <Button variant="outline" onClick={handleStartEdit}>Edit Details</Button>
          ) : null}
          
          {isEditing ? (
            <>
              <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
              <Button 
                onClick={handleSave} 
                disabled={updateMutation.isPending || !remark.trim()}
                title={!remark.trim() ? "Enter a remark before saving" : undefined}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </>
          ) : null}
          
          {invoice?.status === "reviewing" || invoice?.status === "extracted" ? (
            <Button onClick={handleApprove} disabled={approveMutation.isPending} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
          ) : null}
          
          {invoice?.status === "approved" ? (
            <Button onClick={handlePush} disabled={pushMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Send className="mr-2 h-4 w-4" />
              Push to ERP
            </Button>
          ) : null}
        </div>
      </div>

      {invoice?.erpError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-red-600" />
          <div>
            <h4 className="font-medium text-red-900">ERP Sync Failed</h4>
            <p className="text-sm mt-1">{invoice.erpError}</p>
          </div>
        </div>
      )}

      {/* Remark banner — shown only while editing */}
      {isEditing && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <Label htmlFor="edit-remark" className="text-amber-900 font-medium">
                  Reason for edit <span className="text-red-600">*</span>
                </Label>
                <Textarea
                  id="edit-remark"
                  placeholder="Describe what you're changing and why (e.g. 'Corrected GSTIN from OCR error', 'Updated tax amounts to match physical invoice')…"
                  value={remark}
                  onChange={e => setRemark(e.target.value)}
                  rows={2}
                  className="bg-white border-amber-300 focus-visible:ring-amber-400"
                />
                <p className="text-xs text-amber-700">
                  This remark and a full before/after record will be saved to the audit log.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Invoice Number</Label>
                  {isEditing ? (
                    <Input value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} />
                  ) : (
                    <div className="font-medium">{invoice?.invoiceNumber || "-"}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Invoice Date</Label>
                  {isEditing ? (
                    <Input type="date" value={formData.invoiceDate ? formData.invoiceDate.split('T')[0] : ''} onChange={e => setFormData({...formData, invoiceDate: e.target.value})} />
                  ) : (
                    <div className="font-medium">{invoice?.invoiceDate ? format(new Date(invoice.invoiceDate), 'PPP') : "-"}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Place of Supply</Label>
                  {isEditing ? (
                    <Input value={formData.placeOfSupply} onChange={e => setFormData({...formData, placeOfSupply: e.target.value})} />
                  ) : (
                    <div className="font-medium">{invoice?.placeOfSupply || "-"}</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              {isEditing && (
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" /> Add Row
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Description</TableHead>
                    <TableHead>HSN</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>GST %</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {isEditing && <TableHead className="w-[50px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isEditing ? 7 : 6} className="text-center text-muted-foreground py-8">
                        No items found
                      </TableCell>
                    </TableRow>
                  ) : (
                    formData.items.map((item: any, index: number) => (
                      <TableRow key={item.id || index}>
                        <TableCell>
                          {isEditing ? (
                            <Input value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} />
                          ) : (
                            <span className="font-medium">{item.description}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input value={item.hsn || ''} onChange={e => handleItemChange(index, 'hsn', e.target.value)} />
                          ) : (
                            <span>{item.hsn || '-'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input type="number" value={item.quantity || ''} onChange={e => handleItemChange(index, 'quantity', e.target.value)} className="w-20" />
                          ) : (
                            <span>{item.quantity} {item.uom}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input type="number" value={item.rate || ''} onChange={e => handleItemChange(index, 'rate', e.target.value)} className="w-24" />
                          ) : (
                            <span>₹{item.rate}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input type="number" value={item.gstPercent || ''} onChange={e => handleItemChange(index, 'gstPercent', e.target.value)} className="w-20" />
                          ) : (
                            <span>{item.gstPercent}%</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Input type="number" value={item.amount || ''} onChange={e => handleItemChange(index, 'amount', e.target.value)} className="w-24 text-right ml-auto" />
                          ) : (
                            <span>₹{item.amount?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          )}
                        </TableCell>
                        {isEditing && (
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Extracted Name</Label>
                {isEditing ? (
                  <Input value={formData.supplierName} onChange={e => setFormData({...formData, supplierName: e.target.value})} />
                ) : (
                  <div className="font-medium">{invoice?.supplierName || "-"}</div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Extracted GSTIN</Label>
                {isEditing ? (
                  <Input value={formData.supplierGstin} onChange={e => setFormData({...formData, supplierGstin: e.target.value})} />
                ) : (
                  <div className="font-medium">{invoice?.supplierGstin || "-"}</div>
                )}
              </div>
              
              <div className="pt-4 border-t">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">System Match</Label>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className={
                    invoice?.supplierMatchStatus === 'matched' ? 'bg-green-50 text-green-700 border-green-200' :
                    invoice?.supplierMatchStatus === 'manual' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-slate-50 text-slate-700 border-slate-200'
                  }>
                    {invoice?.supplierMatchStatus === 'matched' ? 'Auto Matched' :
                     invoice?.supplierMatchStatus === 'manual' ? 'Manually Matched' : 'Unmatched'}
                  </Badge>
                </div>
                
                <Select 
                  value={invoice?.matchedSupplierId || "none"} 
                  onValueChange={(val) => handleSupplierMatch(val)}
                  disabled={matchMutation.isPending || isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier from master" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Clear Match --</SelectItem>
                    {suppliersData?.data.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.gstin})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Taxable Value</span>
                {isEditing ? (
                  <Input type="number" value={formData.taxableValue} onChange={e => setFormData({...formData, taxableValue: Number(e.target.value)})} className="w-32 text-right h-8" />
                ) : (
                  <span className="font-medium">₹{invoice?.taxableValue?.toLocaleString(undefined, {minimumFractionDigits: 2}) || "0.00"}</span>
                )}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">CGST</span>
                {isEditing ? (
                  <Input type="number" value={formData.cgst} onChange={e => setFormData({...formData, cgst: Number(e.target.value)})} className="w-32 text-right h-8" />
                ) : (
                  <span className="font-medium">₹{invoice?.cgst?.toLocaleString(undefined, {minimumFractionDigits: 2}) || "0.00"}</span>
                )}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">SGST</span>
                {isEditing ? (
                  <Input type="number" value={formData.sgst} onChange={e => setFormData({...formData, sgst: Number(e.target.value)})} className="w-32 text-right h-8" />
                ) : (
                  <span className="font-medium">₹{invoice?.sgst?.toLocaleString(undefined, {minimumFractionDigits: 2}) || "0.00"}</span>
                )}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">IGST</span>
                {isEditing ? (
                  <Input type="number" value={formData.igst} onChange={e => setFormData({...formData, igst: Number(e.target.value)})} className="w-32 text-right h-8" />
                ) : (
                  <span className="font-medium">₹{invoice?.igst?.toLocaleString(undefined, {minimumFractionDigits: 2}) || "0.00"}</span>
                )}
              </div>
              <div className="pt-3 border-t flex justify-between items-center">
                <span className="font-medium">Grand Total</span>
                {isEditing ? (
                  <Input type="number" value={formData.grandTotal} onChange={e => setFormData({...formData, grandTotal: Number(e.target.value)})} className="w-32 text-right h-8 font-bold" />
                ) : (
                  <span className="font-bold text-lg">₹{invoice?.grandTotal?.toLocaleString(undefined, {minimumFractionDigits: 2}) || "0.00"}</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Invoice Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice?.fileUrl ? (
                <>
                  <div className="relative bg-slate-100 rounded-md overflow-hidden aspect-video flex items-center justify-center">
                    {invoice.fileType === "application/pdf" ? (
                      <div className="text-center space-y-2">
                        <div className="text-4xl">📄</div>
                        <p className="text-sm text-muted-foreground">{invoice.fileName}</p>
                      </div>
                    ) : (
                      <img 
                        src={invoice.fileUrl} 
                        alt={invoice.fileName}
                        className="max-w-full max-h-full object-contain"
                      />
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      className="flex-1" 
                      onClick={() => setShowPreview(true)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Full
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      asChild
                    >
                      <a href={invoice.fileUrl} download={invoice.fileName} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </a>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No file preview available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full Screen Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] p-0">
          <DialogHeader className="border-b p-4 flex flex-row items-center justify-between">
            <DialogTitle>{invoice?.fileName}</DialogTitle>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowPreview(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="relative w-full max-h-[calc(90vh-80px)] overflow-auto bg-black flex items-center justify-center">
            {invoice?.fileType === "application/pdf" ? (
              <iframe
                src={invoice.fileUrl}
                className="w-full h-full min-h-[500px]"
                title="Invoice PDF Preview"
              />
            ) : (
              <img 
                src={invoice?.fileUrl}
                alt={invoice?.fileName}
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
