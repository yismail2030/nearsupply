'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RFQ_CATEGORIES, CURRENCIES, UNITS } from '@/lib/utils/helpers';
import { Plus, Trash2, Upload, Download, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  specifications: string;
  link: string;
  imageUrl: string;
}

interface CreateRFQFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  editData?: {
    id: string;
    requestType: string;
    title: string;
    description: string;
    category: string;
    budget: number | null;
    currency: string;
    deadlineDate: string | null;
    deliveryDate: string | null;
    deliveryTerms: string | null;
    deliveryAddress: string | null;
    notes: string | null;
    lineItems: LineItem[];
    attachments: Array<{ name: string; url: string; size: number; type: string }>;
  } | null;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const emptyLineItem: LineItem = {
  id: generateId(),
  name: '',
  quantity: 1,
  unit: 'Piece',
  specifications: '',
  link: '',
  imageUrl: '',
};

export function CreateRFQForm({ onSuccess, onCancel, editData }: CreateRFQFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [lineItemsDialogOpen, setLineItemsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    requestType: editData?.requestType || 'PRODUCT',
    title: editData?.title || '',
    description: editData?.description || '',
    category: editData?.category || '',
    budget: editData?.budget || '',
    currency: editData?.currency || 'USD',
    deadlineDate: editData?.deadlineDate ? editData.deadlineDate.split('T')[0] : '',
    deliveryDate: editData?.deliveryDate ? editData.deliveryDate.split('T')[0] : '',
    deliveryTerms: editData?.deliveryTerms || '',
    deliveryAddress: editData?.deliveryAddress || '',
    notes: editData?.notes || '',
    lineItems: editData?.lineItems || [{ ...emptyLineItem, id: generateId() }],
    attachments: editData?.attachments || [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim() || formData.title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }

    if (!formData.description.trim() || formData.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    const validItems = formData.lineItems.filter((item) => item.name.trim());
    if (validItems.length === 0) {
      newErrors.lineItems = 'At least one line item with a name is required';
    }

    const itemsWithQuantity = validItems.filter((item) => item.quantity > 0);
    if (validItems.length > 0 && itemsWithQuantity.length !== validItems.length) {
      newErrors.lineItems = 'All items must have a quantity greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (asDraft: boolean = false) => {
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors before submitting',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const validItems = formData.lineItems.filter((item) => item.name.trim());

      const payload = {
        requestType: formData.requestType,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        budget: formData.budget ? parseFloat(formData.budget as unknown as string) : null,
        currency: formData.currency,
        deadlineDate: formData.deadlineDate || null,
        deliveryDate: formData.deliveryDate || null,
        deliveryTerms: formData.deliveryTerms || null,
        deliveryAddress: formData.deliveryAddress || null,
        notes: formData.notes || null,
        attachments: formData.attachments,
        lineItems: validItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit || undefined,
          specifications: item.specifications || undefined,
          link: item.link || undefined,
          imageUrl: item.imageUrl || undefined,
        })),
      };

      const url = editData ? `/api/rfq/${editData.id}` : '/api/rfq';
      const method = editData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save RFQ');
      }

      // If submitting (not draft), update status
      if (!asDraft && !editData) {
        const submitRes = await fetch(`/api/rfq/${data.data.rfq.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'submit' }),
        });
        const submitData = await submitRes.json();
        if (!submitData.success) {
          throw new Error(submitData.error || 'Failed to submit RFQ');
        }
      }

      toast({
        title: 'Success',
        description: asDraft ? 'RFQ saved as draft' : 'RFQ submitted successfully',
      });

      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save RFQ',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addLineItem = () => {
    setFormData({
      ...formData,
      lineItems: [...formData.lineItems, { ...emptyLineItem, id: generateId() }],
    });
  };

  const removeLineItem = (id: string) => {
    if (formData.lineItems.length > 1) {
      setFormData({
        ...formData,
        lineItems: formData.lineItems.filter((item) => item.id !== id),
      });
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setFormData({
      ...formData,
      lineItems: formData.lineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const formDataObj = new FormData();
      formDataObj.append('file', file);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formDataObj,
        });
        const data = await res.json();

        if (data.success) {
          setFormData({
            ...formData,
            attachments: [...formData.attachments, data.data.attachment],
          });
        } else {
          throw new Error(data.error);
        }
      } catch (error) {
        toast({
          title: 'Upload Error',
          description: error instanceof Error ? error.message : 'Failed to upload file',
          variant: 'destructive',
        });
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setFormData({
      ...formData,
      attachments: formData.attachments.filter((_, i) => i !== index),
    });
  };

  // CSV Template Download
  const downloadCSVTemplate = () => {
    const headers = [
      'Item Name*',
      'Quantity*',
      'Unit',
      'Specifications / Details',
      'Product/Service Link',
      'Image/File URL',
    ];

    const exampleRows =
      formData.requestType === 'PRODUCT'
        ? [
            ['Office Chair', '10', 'Piece', 'Ergonomic design, adjustable height', 'https://example.com/chair', ''],
            ['Desk Lamp', '20', 'Piece', 'LED, 5W, white color', '', ''],
          ]
        : [
            ['Consulting Services', '40', 'Hour', 'Business strategy consulting', '', ''],
            ['Software Development', '100', 'Hour', 'Full-stack development', 'https://example.com/specs', ''],
          ];

    const csvContent = [
      '# NearSupply RFQ Line Items Template',
      '# Request Type: ' + formData.requestType,
      '# Lines starting with # are comments and will be ignored',
      '# Fields marked with * are required',
      '',
      headers.join(','),
      ...exampleRows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rfq-template-${formData.requestType.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV Import
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');

        const newItems: LineItem[] = [];

        for (const line of lines) {
          // Skip empty lines and comments
          if (!line.trim() || line.trim().startsWith('#')) continue;

          // Parse CSV line (handle quoted values)
          const values: string[] = [];
          let current = '';
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());

          // Skip header row
          if (values[0]?.toLowerCase().includes('item name')) continue;

          if (values[0]) {
            newItems.push({
              id: generateId(),
              name: values[0] || '',
              quantity: parseFloat(values[1]) || 1,
              unit: values[2] || 'Piece',
              specifications: values[3] || '',
              link: values[4] || '',
              imageUrl: values[5] || '',
            });
          }
        }

        if (newItems.length > 0) {
          setFormData({
            ...formData,
            lineItems: newItems,
          });
          toast({
            title: 'Import Successful',
            description: `${newItems.length} items imported`,
          });
          setLineItemsDialogOpen(false);
        } else {
          throw new Error('No valid items found in CSV');
        }
      } catch (error) {
        toast({
          title: 'Import Error',
          description: error instanceof Error ? error.message : 'Failed to parse CSV file',
          variant: 'destructive',
        });
      }
    };

    reader.readAsText(file);
    if (csvInputRef.current) {
      csvInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editData ? 'Edit RFQ' : 'Create New RFQ'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Request Type *</Label>
            <Select
              value={formData.requestType}
              onValueChange={(value) => setFormData({ ...formData, requestType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRODUCT">Product</SelectItem>
                <SelectItem value="SERVICE">Service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {RFQ_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-sm text-red-500">{errors.category}</p>}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="RFQ title"
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Description *</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your requirements..."
              rows={4}
              className={errors.description ? 'border-red-500' : ''}
            />
            {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
          </div>

          <div className="space-y-2">
            <Label>Budget (Optional)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                placeholder="0.00"
              />
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Deadline Date</Label>
            <Input
              type="date"
              value={formData.deadlineDate}
              onChange={(e) => setFormData({ ...formData, deadlineDate: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Delivery Date</Label>
            <Input
              type="date"
              value={formData.deliveryDate}
              onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Delivery Terms</Label>
            <Input
              value={formData.deliveryTerms}
              onChange={(e) => setFormData({ ...formData, deliveryTerms: e.target.value })}
              placeholder="e.g., FOB, CIF"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Delivery Address</Label>
            <Input
              value={formData.deliveryAddress}
              onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
              placeholder="Delivery location"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>
        </div>

        {/* Attachments */}
        <div className="space-y-2">
          <Label>Attachments</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.attachments.map((att, index) => (
              <Badge key={index} variant="secondary" className="gap-1">
                {att.name}
                <button
                  onClick={() => removeAttachment(index)}
                  className="ml-1 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp,.zip,.rar"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Line Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Line Items *</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadCSVTemplate}
              >
                <Download className="mr-2 h-4 w-4" />
                Template
              </Button>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVImport}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => csvInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
              <Button type="button" size="sm" onClick={addLineItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
          </div>

          {errors.lineItems && <p className="text-sm text-red-500">{errors.lineItems}</p>}

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64">Item Name *</TableHead>
                  <TableHead className="w-24">Qty *</TableHead>
                  <TableHead className="w-32">Unit</TableHead>
                  <TableHead className="w-48">Specifications</TableHead>
                  <TableHead className="w-48">Link</TableHead>
                  <TableHead className="w-48">Image URL</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formData.lineItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Input
                        value={item.name}
                        onChange={(e) => updateLineItem(item.id, 'name', e.target.value)}
                        placeholder="Item name"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.unit}
                        onValueChange={(value) => updateLineItem(item.id, 'unit', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.specifications}
                        onChange={(e) => updateLineItem(item.id, 'specifications', e.target.value)}
                        placeholder="Details"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.link}
                        onChange={(e) => updateLineItem(item.id, 'link', e.target.value)}
                        placeholder="https://..."
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.imageUrl}
                        onChange={(e) => updateLineItem(item.id, 'imageUrl', e.target.value)}
                        placeholder="https://..."
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(item.id)}
                        disabled={formData.lineItems.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-4">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSubmit(true)}
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save as Draft
        </Button>
        <Button onClick={() => handleSubmit(false)} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Submit RFQ
        </Button>
      </CardFooter>
    </Card>
  );
}
