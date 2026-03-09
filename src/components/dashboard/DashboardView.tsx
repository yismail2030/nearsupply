'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils/helpers';
import { FileText, Package, Building2, Users, TrendingUp, Clock, Plus, Eye, ArrowRight } from 'lucide-react';
import { ViewType } from '@/components/shared/DashboardLayout';

interface DashboardStats {
  totalRFQs: number;
  draftRFQs: number;
  submittedRFQs: number;
  completedRFQs: number;
  totalProducts: number;
  totalProposals: number;
  pendingProposals: number;
  totalBudget: number;
}

interface DashboardViewProps {
  onNavigate?: (view: ViewType) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalRFQs: 0,
    draftRFQs: 0,
    submittedRFQs: 0,
    completedRFQs: 0,
    totalProducts: 0,
    totalProposals: 0,
    pendingProposals: 0,
    totalBudget: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch RFQs
        const rfqRes = await fetch('/api/rfq');
        const rfqData = await rfqRes.json();

        // Fetch Products
        const productRes = await fetch('/api/products');
        const productData = await productRes.json();

        // Fetch Proposals
        const proposalRes = await fetch('/api/proposals');
        const proposalData = await proposalRes.json();

        if (rfqData.success && productData.success && proposalData.success) {
          const rfqs = rfqData.data.rfqs;
          const products = productData.data.products;
          const proposals = proposalData.data.proposals;

          setStats({
            totalRFQs: rfqs.length,
            draftRFQs: rfqs.filter((r: { status: string }) => r.status === 'DRAFT').length,
            submittedRFQs: rfqs.filter((r: { status: string }) => r.status === 'SUBMITTED' || r.status === 'ASSIGNED').length,
            completedRFQs: rfqs.filter((r: { status: string }) => r.status === 'COMPLETED').length,
            totalProducts: products.length,
            totalProposals: proposals.length,
            pendingProposals: proposals.filter((p: { status: string }) => p.status === 'SUBMITTED').length,
            totalBudget: rfqs.reduce((sum: number, r: { budget: number | null }) => sum + (r.budget || 0), 0),
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getRoleSpecificStats = () => {
    if (user?.role === 'CLIENT') {
      return [
        { title: 'My RFQs', value: stats.totalRFQs, icon: FileText, color: 'text-blue-600' },
        { title: 'Pending', value: stats.submittedRFQs, icon: Clock, color: 'text-yellow-600' },
        { title: 'Completed', value: stats.completedRFQs, icon: TrendingUp, color: 'text-green-600' },
        { title: 'Total Budget', value: formatCurrency(stats.totalBudget, 'USD'), icon: FileText, color: 'text-purple-600' },
      ];
    }

    if (user?.role === 'SUPPLIER') {
      return [
        { title: 'My Products', value: stats.totalProducts, icon: Package, color: 'text-blue-600' },
        { title: 'Proposals', value: stats.totalProposals, icon: Building2, color: 'text-purple-600' },
        { title: 'Pending', value: stats.pendingProposals, icon: Clock, color: 'text-yellow-600' },
      ];
    }

    // Admin
    return [
      { title: 'Total RFQs', value: stats.totalRFQs, icon: FileText, color: 'text-blue-600' },
      { title: 'Products', value: stats.totalProducts, icon: Package, color: 'text-green-600' },
      { title: 'Proposals', value: stats.totalProposals, icon: Building2, color: 'text-purple-600' },
      { title: 'Total Budget', value: formatCurrency(stats.totalBudget, 'USD'), icon: TrendingUp, color: 'text-orange-600' },
    ];
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Loading dashboard...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {getWelcomeMessage()}, {user?.name}!
        </h1>
        <p className="text-muted-foreground">
          Welcome to NearSupply - Your RFQ & Quotation Management Platform
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {getRoleSpecificStats().map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {user?.role === 'CLIENT' && (
              <div 
                className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                onClick={() => onNavigate?.('rfq-create')}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Create RFQ</h3>
                  <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Start a new request for quotation
                </p>
              </div>
            )}
            {(user?.role === 'SUPPLIER' || user?.role === 'ADMIN') && (
              <div 
                className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                onClick={() => onNavigate?.('products')}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Add Product</h3>
                  <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Add a new product to your catalog
                </p>
              </div>
            )}
            <div 
              className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
              onClick={() => onNavigate?.('proposals')}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">View Proposals</h3>
                <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-sm text-muted-foreground">
                Review and manage proposals
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Info */}
      <Card>
        <CardHeader>
          <CardTitle>Your Role</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge
              className={
                user?.role === 'ADMIN'
                  ? 'bg-red-100 text-red-800'
                  : user?.role === 'SUPPLIER'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-green-100 text-green-800'
              }
            >
              {user?.role}
            </Badge>
            <p className="text-muted-foreground">
              {user?.role === 'ADMIN'
                ? 'You have full access to all features and can manage users, RFQs, and proposals.'
                : user?.role === 'SUPPLIER'
                ? 'You can manage your product catalog and submit proposals for RFQs.'
                : 'You can create RFQs and review proposals from suppliers.'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
