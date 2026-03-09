'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate, getRFQStatusColor, getProposalStatusColor, safeJsonParse } from '@/lib/utils/helpers';
import { RFQRequest, RFQItem, Proposal, User } from '@prisma/client';
import { Building2, Calendar, MapPin, FileText, ExternalLink, Send, CheckCircle, XCircle, Users, Edit, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type RFQWithRelations = RFQRequest & {
  lineItems: RFQItem[];
  proposals: (Proposal & { supplier: Pick<User, 'id' | 'name' | 'company' | 'email' | 'logo'> })[];
  client: Pick<User, 'id' | 'name' | 'company' | 'email' | 'phone'>;
};

interface RFQDetailDialogProps {
  rfq: RFQWithRelations | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (rfq: RFQWithRelations) => void;
  onRefresh?: () => void;
}

export function RFQDetailDialog({ rfq, open, onClose, onEdit, onRefresh }: RFQDetailDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<User[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [proposalDetail, setProposalDetail] = useState<Proposal | null>(null);

  // Fetch suppliers for assignment (admin only)
  useEffect(() => {
    if (user?.role === 'ADMIN' && assignDialogOpen) {
      fetch('/api/users?role=SUPPLIER')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setSuppliers(data.data.users);
            // Pre-select already assigned suppliers
            if (rfq?.assignedSuppliers) {
              const assigned = safeJsonParse<string[]>(rfq.assignedSuppliers, []);
              setSelectedSuppliers(assigned);
            }
          }
        });
    }
  }, [user?.role, assignDialogOpen, rfq?.assignedSuppliers]);

  const handleAssignSuppliers = async () => {
    if (!rfq) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/rfq/${rfq.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', suppliers: selectedSuppliers }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Suppliers assigned successfully',
        });
        setAssignDialogOpen(false);
        onRefresh?.();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign suppliers',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!rfq) return null;

  const attachments = safeJsonParse<Array<{ name: string; url: string }>>(rfq.attachments, []);
  const assignedSuppliers = safeJsonParse<string[]>(rfq.assignedSuppliers, []);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl">{rfq.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <span className="font-mono">{rfq.requestNumber}</span>
                  <Badge className={getRFQStatusColor(rfq.status)}>{rfq.status}</Badge>
                  <Badge variant="outline">{rfq.requestType}</Badge>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium">{rfq.category || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Deadline</p>
                  <p className="font-medium">{formatDate(rfq.deadlineDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Delivery</p>
                  <p className="font-medium">{formatDate(rfq.deliveryDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Budget</p>
                  <p className="font-medium">
                    {rfq.budget ? formatCurrency(rfq.budget, rfq.currency) : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {rfq.description}
              </p>
            </div>

            {/* Client Info */}
            {user?.role === 'ADMIN' && (
              <div>
                <h4 className="font-medium mb-2">Client</h4>
                <p className="text-sm">
                  {rfq.client.company || rfq.client.name} ({rfq.client.email})
                </p>
              </div>
            )}

            {/* Delivery Terms */}
            {(rfq.deliveryTerms || rfq.deliveryAddress) && (
              <div>
                <h4 className="font-medium mb-2">Delivery</h4>
                {rfq.deliveryTerms && (
                  <p className="text-sm">Terms: {rfq.deliveryTerms}</p>
                )}
                {rfq.deliveryAddress && (
                  <p className="text-sm text-muted-foreground">{rfq.deliveryAddress}</p>
                )}
              </div>
            )}

            {/* Notes */}
            {rfq.notes && (
              <div>
                <h4 className="font-medium mb-2">Notes</h4>
                <p className="text-sm text-muted-foreground">{rfq.notes}</p>
              </div>
            )}

            {/* Attachments */}
            {attachments.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Attachments</h4>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((att, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(att.url, '_blank')}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      {att.name}
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Line Items */}
            <div>
              <h4 className="font-medium mb-2">Line Items ({rfq.lineItems.length})</h4>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Specifications</TableHead>
                      <TableHead>Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rfq.lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.unit || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {item.specifications || '-'}
                        </TableCell>
                        <TableCell>
                          {item.link ? (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              Link <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Proposals */}
            {rfq.proposals.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Proposals ({rfq.proposals.length})</h4>
                <div className="space-y-3">
                  {rfq.proposals.map((proposal) => (
                    <Card key={proposal.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{proposal.supplier.company || proposal.supplier.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {proposal.proposalNumber} • Grand Total:{' '}
                              {formatCurrency(proposal.grandTotal, proposal.currency)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getProposalStatusColor(proposal.status)}>
                              {proposal.status}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setProposalDetail(proposal)}
                            >
                              View
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <DialogFooter className="flex flex-wrap gap-2">
              {user?.role === 'ADMIN' && rfq.status === 'SUBMITTED' && (
                <Button onClick={() => setAssignDialogOpen(true)}>
                  <Users className="mr-2 h-4 w-4" />
                  Assign Suppliers
                </Button>
              )}
              {user?.role === 'ADMIN' && rfq.status === 'ASSIGNED' && (
                <Button onClick={() => setAssignDialogOpen(true)} variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Modify Assignment
                </Button>
              )}
              {onEdit && (rfq.status === 'DRAFT' || rfq.status === 'SUBMITTED' || user?.role === 'ADMIN') && 
               rfq.status !== 'COMPLETED' && rfq.status !== 'CANCELLED' && (
                <Button variant="outline" onClick={() => onEdit(rfq)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Suppliers Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Suppliers</DialogTitle>
            <DialogDescription>
              Select suppliers to assign to this RFQ
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {suppliers.map((supplier) => (
              <label
                key={supplier.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={selectedSuppliers.includes(supplier.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedSuppliers([...selectedSuppliers, supplier.id]);
                    } else {
                      setSelectedSuppliers(selectedSuppliers.filter((id) => id !== supplier.id));
                    }
                  }}
                />
                <div>
                  <p className="font-medium">{supplier.company || supplier.name}</p>
                  <p className="text-sm text-muted-foreground">{supplier.email}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignSuppliers} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign ({selectedSuppliers.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proposal Detail Dialog */}
      {proposalDetail && (
        <ProposalDetailDialog
          proposal={proposalDetail}
          open={!!proposalDetail}
          onClose={() => setProposalDetail(null)}
          rfq={rfq}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}

// Proposal Detail Sub-component
function ProposalDetailDialog({
  proposal,
  open,
  onClose,
  rfq,
  onRefresh,
}: {
  proposal: Proposal;
  open: boolean;
  onClose: () => void;
  rfq: RFQWithRelations;
  onRefresh?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const lineItems = safeJsonParse<Array<{
    rfqItemId: string;
    name: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
  }>>(proposal.lineItems, []);

  const handleShare = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'share' }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Proposal shared with client',
        });
        onRefresh?.();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to share proposal',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-email' }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Quote sent by email',
        });
        onRefresh?.();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send email',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Proposal {proposal.proposalNumber}</DialogTitle>
          <DialogDescription>
            From: {rfq.client.company || rfq.client.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Line Items */}
          <div>
            <h4 className="font-medium mb-2">Items</h4>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit || '-'}</TableCell>
                      <TableCell>{formatCurrency(item.unitPrice, proposal.currency)}</TableCell>
                      <TableCell>{formatCurrency(item.totalPrice, proposal.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(proposal.subtotal, proposal.currency)}</span>
            </div>
            {proposal.shippingCost > 0 && (
              <div className="flex justify-between text-sm">
                <span>Shipping</span>
                <span>{formatCurrency(proposal.shippingCost, proposal.currency)}</span>
              </div>
            )}
            {proposal.taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span>Tax ({proposal.taxPercentage}%)</span>
                <span>{formatCurrency(proposal.taxAmount, proposal.currency)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Grand Total</span>
              <span>{formatCurrency(proposal.grandTotal, proposal.currency)}</span>
            </div>
          </div>

          {/* Terms & Conditions */}
          {proposal.termsConditions && (
            <div>
              <h4 className="font-medium mb-2">Terms & Conditions</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {proposal.termsConditions}
              </p>
            </div>
          )}

          {/* Notes */}
          {proposal.notes && (
            <div>
              <h4 className="font-medium mb-2">Notes</h4>
              <p className="text-sm text-muted-foreground">{proposal.notes}</p>
            </div>
          )}

          {/* Email Status */}
          {proposal.emailSentAt && (
            <div className="text-sm text-muted-foreground">
              Email sent to {proposal.emailSentTo} on {formatDate(proposal.emailSentAt)}
            </div>
          )}

          {/* Actions */}
          <DialogFooter className="flex flex-wrap gap-2">
            {user?.role === 'ADMIN' && !proposal.isShared && (
              <Button onClick={handleShare} disabled={loading}>
                Share with Client
              </Button>
            )}
            {user?.role === 'ADMIN' && proposal.isShared && !proposal.emailSentAt && (
              <Button onClick={handleSendEmail} disabled={loading}>
                <Send className="mr-2 h-4 w-4" />
                Send by Email
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
