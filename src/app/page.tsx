'use client';

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AuthPage } from '@/components/auth/AuthPage';
import { SetupForm } from '@/components/auth/SetupForm';
import { DashboardLayout, ViewType } from '@/components/shared/DashboardLayout';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { RFQList } from '@/components/rfq/RFQList';
import { CreateRFQForm } from '@/components/rfq/CreateRFQForm';
import { RFQDetailDialog } from '@/components/rfq/RFQDetailDialog';
import { ProductsList } from '@/components/products/ProductsList';
import { ProposalsList } from '@/components/proposals/ProposalsList';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { UsersManagement } from '@/components/users/UsersManagement';
import { RFQRequest, RFQItem, Proposal, User } from '@prisma/client';

type RFQWithRelations = RFQRequest & {
  lineItems: RFQItem[];
  proposals: (Proposal & { supplier: Pick<User, 'id' | 'name' | 'company'> })[];
  client: Pick<User, 'id' | 'name' | 'company' | 'email'>;
};

function AppContent() {
  const { user, loading, setupStatus, checkingSetup, checkSetup } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedRFQ, setSelectedRFQ] = useState<RFQWithRelations | null>(null);
  const [editRFQData, setEditRFQData] = useState<RFQWithRelations | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Show loading state
  if (checkingSetup || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading NearSupply...</p>
        </div>
      </div>
    );
  }

  // Show setup form if no admin exists
  if (setupStatus?.needsSetup && !user) {
    return <SetupForm onComplete={checkSetup} />;
  }

  // Show auth page if not logged in
  if (!user) {
    return <AuthPage />;
  }

  // Handle RFQ actions
  const handleCreateRFQ = () => {
    setEditRFQData(null);
    setCurrentView('rfq-create');
  };

  const handleViewRFQDetail = (rfq: RFQWithRelations) => {
    setSelectedRFQ(rfq);
    setDetailOpen(true);
  };

  const handleEditRFQ = (rfq: RFQWithRelations) => {
    setEditRFQData(rfq);
    setCurrentView('rfq-create');
  };

  const handleRFQSuccess = () => {
    setEditRFQData(null);
    setCurrentView('rfq-list');
  };

  // Render content based on current view
  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView onNavigate={setCurrentView} />;

      case 'rfq-list':
        return (
          <RFQList
            onCreateNew={handleCreateRFQ}
            onViewDetail={handleViewRFQDetail}
            onEdit={handleEditRFQ}
          />
        );

      case 'rfq-create':
        return (
          <CreateRFQForm
            onSuccess={handleRFQSuccess}
            onCancel={() => {
              setEditRFQData(null);
              setCurrentView('rfq-list');
            }}
            editData={
              editRFQData
                ? {
                    id: editRFQData.id,
                    requestType: editRFQData.requestType,
                    title: editRFQData.title,
                    description: editRFQData.description || '',
                    category: editRFQData.category || '',
                    budget: editRFQData.budget,
                    currency: editRFQData.currency,
                    deadlineDate: editRFQData.deadlineDate
                      ? (typeof editRFQData.deadlineDate === 'string'
                          ? editRFQData.deadlineDate
                          : editRFQData.deadlineDate.toISOString())
                      : null,
                    deliveryDate: editRFQData.deliveryDate
                      ? (typeof editRFQData.deliveryDate === 'string'
                          ? editRFQData.deliveryDate
                          : editRFQData.deliveryDate.toISOString())
                      : null,
                    deliveryTerms: editRFQData.deliveryTerms,
                    deliveryAddress: editRFQData.deliveryAddress,
                    notes: editRFQData.notes,
                    lineItems: editRFQData.lineItems.map((item) => ({
                      id: item.id,
                      name: item.name,
                      quantity: item.quantity,
                      unit: item.unit || '',
                      specifications: item.specifications || '',
                      link: item.link || '',
                      imageUrl: item.imageUrl || '',
                    })),
                    attachments: editRFQData.attachments
                      ? JSON.parse(editRFQData.attachments)
                      : [],
                  }
                : null
            }
          />
        );

      case 'products':
        return <ProductsList />;

      case 'proposals':
        return <ProposalsList />;

      case 'profile':
        return <ProfileForm />;

      case 'users':
        return <UsersManagement />;

      default:
        return <DashboardView />;
    }
  };

  return (
    <>
      <DashboardLayout currentView={currentView} onViewChange={setCurrentView}>
        {renderContent()}
      </DashboardLayout>

      {/* RFQ Detail Dialog */}
      <RFQDetailDialog
        rfq={selectedRFQ}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedRFQ(null);
        }}
        onEdit={handleEditRFQ}
        onRefresh={() => {
          // Trigger refresh by changing view
          setCurrentView('rfq-list');
        }}
      />
    </>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
