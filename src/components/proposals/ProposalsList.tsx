'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate, getProposalStatusColor, safeJsonParse } from '@/lib/utils/helpers';
import { Proposal, RFQRequest, RFQItem, User } from '@prisma/client';
import { Search, FileText, Send, Loader2, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ProposalWithRelations = Proposal & {
  rfq: RFQRequest & {
    lineItems: RFQItem[];
    client: Pick<User, 'id' | 'name' | 'company' | 'email'>;
  };
  supplier: Pick<User, 'id' | 'name' | 'company' | 'email' | 'logo'>;
};

export function ProposalsList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [proposals, setProposals] = useState<ProposalWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithRelations | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchProposals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/proposals');
      const data = await res.json();
      if (data.success) {
        setProposals(data.data.proposals);
      }
    } catch (error) {
      console.error('Error fetching proposals:', error);
      toast({
        title: 'Error',
        description: 'Failed to load proposals',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleShare = async (proposalId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
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
        fetchProposals();
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
      setSaving(false);
    }
  };

  const handleSendEmail = async (proposalId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
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
        fetchProposals();
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
      setSaving(false);
    }
  };

  const handleAccept = async (proposalId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Proposal accepted',
        });
        fetchProposals();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to accept proposal',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (proposalId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Proposal rejected',
        });
        fetchProposals();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reject proposal',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredProposals = proposals.filter((proposal) => {
    const matchesSearch =
      proposal.proposalNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proposal.rfq.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proposal.supplier.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proposal.supplier.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const openDetail = (proposal: ProposalWithRelations) => {
    setSelectedProposal(proposal);
    setDetailOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Proposals</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search proposals..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading proposals...</div>
          ) : filteredProposals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No proposals found</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proposal #</TableHead>
                    <TableHead>RFQ</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Shared</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell className="font-mono text-sm">
                        {proposal.proposalNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium truncate max-w-48">{proposal.rfq.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {proposal.rfq.requestNumber}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p>{proposal.supplier.company || proposal.supplier.name}</p>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(proposal.grandTotal, proposal.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getProposalStatusColor(proposal.status)}>
                          {proposal.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {proposal.isShared ? (
                          <span className="text-green-600 text-sm">Yes</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDetail(proposal)}
                          >
                            View
                          </Button>
                          {user?.role === 'ADMIN' && !proposal.isShared && (
                            <Button
                              size="sm"
                              onClick={() => handleShare(proposal.id)}
                              disabled={saving}
                            >
                              Share
                            </Button>
                          )}
                          {user?.role === 'ADMIN' && proposal.isShared && !proposal.emailSentAt && (
                            <Button
                              size="sm"
                              onClick={() => handleSendEmail(proposal.id)}
                              disabled={saving}
                            >
                              <Send className="mr-1 h-3 w-3" />
                              Email
                            </Button>
                          )}
                          {(user?.role === 'CLIENT' || user?.role === 'ADMIN') &&
                            proposal.isShared &&
                            proposal.status === 'SUBMITTED' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleAccept(proposal.id)}
                                  disabled={saving}
                                >
                                  Accept
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleReject(proposal.id)}
                                  disabled={saving}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proposal Details</DialogTitle>
          </DialogHeader>

          {selectedProposal && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Proposal Number</p>
                  <p className="font-mono">{selectedProposal.proposalNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={getProposalStatusColor(selectedProposal.status)}>
                    {selectedProposal.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">RFQ</p>
                  <p>{selectedProposal.rfq.title}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Supplier</p>
                  <p>{selectedProposal.supplier.company || selectedProposal.supplier.name}</p>
                </div>
              </div>

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
                      {safeJsonParse<Array<{
                        name: string;
                        quantity: number;
                        unit?: string;
                        unitPrice: number;
                        totalPrice: number;
                      }>>(selectedProposal.lineItems, []).map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.unit || '-'}</TableCell>
                          <TableCell>
                            {formatCurrency(item.unitPrice, selectedProposal.currency)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(item.totalPrice, selectedProposal.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-2 bg-muted p-4 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedProposal.subtotal, selectedProposal.currency)}</span>
                </div>
                {selectedProposal.adminMargin > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Admin Margin</span>
                    <span>{formatCurrency(selectedProposal.adminMargin, selectedProposal.currency)}</span>
                  </div>
                )}
                {selectedProposal.shippingCost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Shipping</span>
                    <span>{formatCurrency(selectedProposal.shippingCost, selectedProposal.currency)}</span>
                  </div>
                )}
                {selectedProposal.taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Tax ({selectedProposal.taxPercentage}%)</span>
                    <span>{formatCurrency(selectedProposal.taxAmount, selectedProposal.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Grand Total</span>
                  <span>{formatCurrency(selectedProposal.grandTotal, selectedProposal.currency)}</span>
                </div>
              </div>

              {/* Terms */}
              {selectedProposal.termsConditions && (
                <div>
                  <h4 className="font-medium mb-2">Terms & Conditions</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedProposal.termsConditions}
                  </p>
                </div>
              )}

              {/* Notes */}
              {selectedProposal.notes && (
                <div>
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground">{selectedProposal.notes}</p>
                </div>
              )}

              {/* Delivery Terms */}
              {selectedProposal.deliveryTerms && (
                <div>
                  <h4 className="font-medium mb-2">Delivery Terms</h4>
                  <p className="text-sm">{selectedProposal.deliveryTerms}</p>
                </div>
              )}

              {/* Email Status */}
              {selectedProposal.emailSentAt && (
                <div className="text-sm text-muted-foreground">
                  <Send className="inline h-4 w-4 mr-1" />
                  Email sent to {selectedProposal.emailSentTo} on {formatDate(selectedProposal.emailSentAt)}
                </div>
              )}

              <DialogFooter className="flex flex-wrap gap-2">
                {user?.role === 'ADMIN' && !selectedProposal.isShared && (
                  <Button onClick={() => { handleShare(selectedProposal.id); setDetailOpen(false); }}>
                    Share with Client
                  </Button>
                )}
                {user?.role === 'ADMIN' && selectedProposal.isShared && !selectedProposal.emailSentAt && (
                  <Button onClick={() => { handleSendEmail(selectedProposal.id); setDetailOpen(false); }}>
                    <Send className="mr-2 h-4 w-4" />
                    Send by Email
                  </Button>
                )}
                {(user?.role === 'CLIENT' || user?.role === 'ADMIN') &&
                  selectedProposal.isShared &&
                  selectedProposal.status === 'SUBMITTED' && (
                    <>
                      <Button
                        onClick={() => { handleAccept(selectedProposal.id); setDetailOpen(false); }}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => { handleReject(selectedProposal.id); setDetailOpen(false); }}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                <Button variant="outline" onClick={() => setDetailOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
