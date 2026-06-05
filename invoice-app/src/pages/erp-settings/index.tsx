import { useState, useEffect } from "react";
import { 
  useGetErpSettings, 
  useUpdateErpSettings, 
  useTestErpConnection,
  useSyncErpSuppliers,
  useSyncErpItems
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Settings, RefreshCcw, Save, CheckCircle2, XCircle } from "lucide-react";

export default function ErpSettings() {
  const { data: settings, isLoading: settingsLoading } = useGetErpSettings();
  const updateMutation = useUpdateErpSettings();
  const testMutation = useTestErpConnection();
  const syncSuppliersMutation = useSyncErpSuppliers();
  const syncItemsMutation = useSyncErpItems();

  const [formData, setFormData] = useState({
    erpUrl: "",
    apiKey: "",
    apiSecret: ""
  });
  
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData({
        erpUrl: settings.erpUrl || "",
        apiKey: settings.apiKey || "",
        apiSecret: "" // Never load secret from server
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateMutation.mutate(
      { data: formData },
      {
        onSuccess: () => toast.success("ERP settings saved successfully"),
        onError: () => toast.error("Failed to save settings")
      }
    );
  };

  const handleTest = () => {
    testMutation.mutate(
      undefined,
      {
        onSuccess: (data) => setTestResult(data),
        onError: () => setTestResult({ success: false, message: "Connection request failed" })
      }
    );
  };

  const handleSyncSuppliers = () => {
    syncSuppliersMutation.mutate(undefined, {
      onSuccess: (data) => toast.success(`Synced ${data.synced} suppliers`),
      onError: () => toast.error("Failed to sync suppliers")
    });
  };

  const handleSyncItems = () => {
    syncItemsMutation.mutate(undefined, {
      onSuccess: (data) => toast.success(`Synced ${data.synced} items`),
      onError: () => toast.error("Failed to sync items")
    });
  };

  return (
    <div className="p-8 space-y-6 bg-background min-h-full max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">ERP Integration</h1>
        <p className="text-muted-foreground mt-1">Configure connection to your ERPNext instance.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Connection Settings
          </CardTitle>
          <CardDescription>
            Enter your ERPNext instance URL and API credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {settingsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="erpUrl">ERPNext URL</Label>
                <Input 
                  id="erpUrl" 
                  value={formData.erpUrl}
                  onChange={e => setFormData({...formData, erpUrl: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input 
                    id="apiKey" 
                    type="password"
                    value={formData.apiKey}
                    onChange={e => setFormData({...formData, apiKey: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="apiSecret">API Secret</Label>
                  <Input 
                    id="apiSecret" 
                    type="password" 
                    value={formData.apiSecret}
                    onChange={e => setFormData({...formData, apiSecret: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground">Only enter to update existing secret.</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={testMutation.isPending}>
                  <RefreshCcw className={`mr-2 h-4 w-4 ${testMutation.isPending ? 'animate-spin' : ''}`} />
                  Test Connection
                </Button>
              </div>

              {testResult && (
                <div className={`p-4 rounded-md border flex items-start gap-3 mt-4 ${testResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  {testResult.success ? 
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 mt-0.5" /> : 
                    <XCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                  }
                  <div>
                    <h4 className="font-medium">{testResult.success ? "Connection Successful" : "Connection Failed"}</h4>
                    <p className="text-sm mt-1">{testResult.message}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Master Data Sync</CardTitle>
          <CardDescription>
            Manually trigger synchronization of master data from ERPNext to local database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Suppliers Master</h4>
              <p className="text-sm text-muted-foreground">Sync all active suppliers and their GSTINs.</p>
            </div>
            <Button variant="outline" onClick={handleSyncSuppliers} disabled={syncSuppliersMutation.isPending} className="mt-3 sm:mt-0 w-full sm:w-auto">
              <RefreshCcw className={`mr-2 h-4 w-4 ${syncSuppliersMutation.isPending ? 'animate-spin' : ''}`} />
              Sync Suppliers
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Items Master</h4>
              <p className="text-sm text-muted-foreground">Sync all items, HSN codes, and tax rates.</p>
            </div>
            <Button variant="outline" onClick={handleSyncItems} disabled={syncItemsMutation.isPending} className="mt-3 sm:mt-0 w-full sm:w-auto">
              <RefreshCcw className={`mr-2 h-4 w-4 ${syncItemsMutation.isPending ? 'animate-spin' : ''}`} />
              Sync Items
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
