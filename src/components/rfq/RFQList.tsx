'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency, formatDate, getRFQStatusColor } from '@/lib/utils/helpers';
import { RFQRequest, RFQItem, Proposal, User } from '@prisma/client';
import { Plus, Search, MoreHorizontal, Eye, Edit, Trash2, Send, Users, XCircle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type RFQWithRelations = RFQRequest & {
  lineItems: RFQItem[];
  proposals: (Proposal & { supplier: Pick<User, 'id' | 'name' | 'company'> })[];
  client: Pick<User, 'id' | 'name' | 'company' | 'email'>;
};

interface RFQListProps {
  onCreateNew: () => void;
  onViewDetail: (rfq: RFQWithRelations) => void;
  onEdit: (rfq: RFQWithRelations) => void;
}

export function RFQList({ onCreateNew, onViewDetail, onEdit }: RFQListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rfqs, setRfqs] = useState<RFQWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; rfqId: string | null }>({
    open: false,
    rfqId: null,
  });

  const fetchRFQs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const res = await fetch(`/api/rfq?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRfqs(data.data.rfqs);
      }
    } catch (error) {
      console.error('Error fetching RFQs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load RFQs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchRFQs();
  }, [fetchRFQs]);

  const handleCancelRFQ = async (rfqId: string) => {
    try {
      const res = await fetch(`/api/rfq/${rfqId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'RFQ cancelled successfully',
        });
        fetchRFQs();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel RFQ',
        variant: 'destructive',
      });
    }
    setCancelDialog({ open: false, rfqId: null });
  };

  const handleDeleteRFQ = async (rfqId: string) => {
    try {
      const res = await fetch(`/api/rfq/${rfqId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'RFQ deleted successfully',
        });
        fetchRFQs();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete RFQ',
        variant: 'destructive',
      });
    }
  };

  const filteredRFQs = rfqs.filter((rfq) => {
    const matchesSearch =
      rfq.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rfq.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rfq.category?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const canEdit = (rfq: RFQRequest) => {
    if (user?.role === 'ADMIN') return rfq.status !== 'COMPLETED' && rfq.status !== 'CANCELLED';
    if (user?.role === 'CLIENT' && rfq.clientId === user.id) {
      return rfq.status === 'DRAFT' || rfq.status === 'SUBMITTED';
    }
    return false;
  };

  const canDelete = (rfq: RFQRequest) => {
    if (user?.role === 'ADMIN') return rfq.status === 'DRAFT';
    if (user?.role === 'CLIENT' && rfq.clientId === user.id) return rfq.status === 'DRAFT';
    return false;
  };

  const canCancel = (rfq: RFQRequest) => {
    if (user?.role === 'ADMIN') return rfq.status !== 'COMPLETED' && rfq.status !== 'CANCELLED';
    if (user?.role === 'CLIENT' && rfq.clientId === user.id) {
      return rfq.status !== 'COMPLETED' && rfq.status !== 'CANCELLED';
    }
    return false;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Request for Quotations</CardTitle>
        {(user?.role === 'CLIENT' || user?.role === 'ADMIN') && (
          <Button onClick={onCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            New RFQ
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search RFQs..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="ASSIGNED">Assigned</SelectItem>
              <SelectItem value="QUOTES_RECEIVED">Quotes Received</SelectItem>
              <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading RFQs...</div>
        ) : filteredRFQs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No RFQs found</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRFQs.map((rfq) => (
                  <TableRow key={rfq.id}>
                    <TableCell className="font-mono text-sm">{rfq.requestNumber}</TableCell>
                    <TableCell className="font-medium">{rfq.title}</TableCell>
                    <TableCell>{rfq.category || '-'}</TableCell>
                    <TableCell>{rfq.lineItems.length}</TableCell>
                    <TableCell>
                      <Badge className={getRFQStatusColor(rfq.status)}>{rfq.status}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(rfq.deadlineDate)}</TableCell>
                    <TableCell>{formatDate(rfq.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onViewDetail(rfq)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {canEdit(rfq) && (
                            <DropdownMenuItem onClick={() => onEdit(rfq)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canCancel(rfq) && (
                            <DropdownMenuItem
                              onClick={() => setCancelDialog({ open: true, rfqId: rfq.id })}
                              className="text-orange-600"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancel
                            </DropdownMenuItem>
                          )}
                          {canDelete(rfq) && (
                            <DropdownMenuItem
                              onClick={() => handleDeleteRFQ(rfq.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog({ open, rfqId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel RFQ</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this RFQ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelDialog.rfqId && handleCancelRFQ(cancelDialog.rfqId)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Yes, cancel RFQ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
