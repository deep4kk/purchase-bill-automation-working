import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getListInvoicesQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, File, FileText, X, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function InvoiceUpload() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(file => 
        file.type === 'application/pdf' || 
        file.type.startsWith('image/')
      );
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter(file => 
        file.type === 'application/pdf' || 
        file.type.startsWith('image/')
      );
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setProgress(0);
    
    let successCount = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('files', file);
      
      try {
        const response = await fetch('/api/invoices/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        if (response.ok) {
          successCount++;
        } else {
          toast.error(`Failed to upload ${file.name}`);
        }
      } catch (err) {
        toast.error(`Error uploading ${file.name}`);
      }
      
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }
    
    setUploading(false);
    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} invoices`);
      queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      setTimeout(() => setLocation('/invoices'), 1000);
    }
  };

  return (
    <div className="p-8 space-y-6 bg-background min-h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Upload Invoices</h1>
        <p className="text-muted-foreground mt-1">Upload PDF or image files to extract purchase invoice data.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <div 
                className="border-2 border-dashed border-muted-foreground/25 rounded-xl bg-muted/10 p-12 text-center transition-colors hover:bg-muted/20 hover:border-primary/50 cursor-pointer flex flex-col items-center justify-center min-h-[400px]"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  multiple 
                  accept="application/pdf,image/png,image/jpeg,image/jpg"
                  onChange={handleFileSelect}
                />
                <div className="p-4 bg-primary/10 rounded-full mb-4">
                  <UploadCloud className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Click to upload or drag and drop</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  Support for PDF, PNG, and JPEG files. You can select multiple files at once. Max 10MB per file.
                </p>
                <Button variant="outline" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                  Browse Files
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex justify-between items-center">
                Selected Files
                <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
                  {files.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 h-[400px]">
              {files.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center space-y-2">
                  <File className="h-8 w-8 opacity-20" />
                  <p className="text-sm">No files selected yet</p>
                </div>
              ) : (
                files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg bg-card text-sm">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="bg-muted p-2 rounded shrink-0">
                        {file.type === 'application/pdf' ? (
                          <FileText className="h-4 w-4 text-blue-500" />
                        ) : (
                          <File className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                      <div className="truncate">
                        <p className="font-medium truncate text-foreground">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    {!uploading && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeFile(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
            
            {files.length > 0 && (
              <div className="p-4 border-t bg-muted/30">
                {uploading ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Uploading...</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                ) : (
                  <Button className="w-full" onClick={handleUpload}>
                    Upload {files.length} {files.length === 1 ? 'file' : 'files'}
                  </Button>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
