import { useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListUsers, 
  useUpdateUserRole,
  getListUsersQueryKey,
  RoleUpdateRole 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function UsersList() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListUsers({ page, limit });
  const updateRoleMutation = useUpdateUserRole();

  const handleRoleChange = (userId: string, newRole: RoleUpdateRole) => {
    updateRoleMutation.mutate(
      { userId, data: { role: newRole } },
      {
        onSuccess: () => {
          toast.success("User role updated successfully");
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        },
        onError: () => toast.error("Failed to update user role")
      }
    );
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-red-100 text-red-800 border-red-200";
      case "accounts": return "bg-blue-100 text-blue-800 border-blue-200";
      case "purchase_manager": return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "auditor": return "bg-slate-100 text-slate-800 border-slate-200";
      default: return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="p-8 space-y-6 bg-background min-h-full max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">Manage system users and their access roles.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32 ml-auto rounded" /></TableCell>
                  </TableRow>
                ))
              ) : data?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                data?.data.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-foreground">
                      {user.name}
                      {currentUser?.id === user.id && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">You</span>}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`font-normal ${getRoleColor(user.role)}`}>
                        {user.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(user.createdAt), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      {currentUser?.id !== user.id && (
                        <div className="flex justify-end">
                          <Select 
                            defaultValue={user.role} 
                            onValueChange={(val: any) => handleRoleChange(user.id, val)}
                            disabled={updateRoleMutation.isPending}
                          >
                            <SelectTrigger className="w-[160px] h-8">
                              <Shield className="mr-2 h-3 w-3" />
                              <SelectValue placeholder="Change Role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="accounts">Accounts</SelectItem>
                              <SelectItem value="purchase_manager">Purchase Manager</SelectItem>
                              <SelectItem value="auditor">Auditor</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {data && data.total > limit && (
            <div className="flex items-center justify-between p-4 border-t">
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
