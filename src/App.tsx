/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult, DraggableProps } from '@hello-pangea/dnd';
import { Plus, Trash2, Edit2, X, Check, AlertCircle, Clock, ExternalLink, GripVertical, ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from './lib/utils';
import { Task, Status, COLUMNS } from './types';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY = 'painel_pendencias_tasks';

const DraggableAny = Draggable as any;

// Robust ID generation
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Helper to update tasks with automatic deduplication
  const updateTasksState = (updater: (prev: Task[]) => Task[]) => {
    setTasks(prev => {
      const next = updater(prev);
      const seen = new Set();
      return next.filter(t => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
    });
  };

  const [isLoaded, setIsLoaded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '',
    description: '',
    priority: 'medium',
    status: 'analise',
  });
  const [newCommentText, setNewCommentText] = useState('');
  const [now, setNow] = useState(Date.now());

  // Update current time every second to refresh alerts
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isTaskAlerting = (task: Task) => {
    if (task.status === 'concluido') return false;
    
    const lastActivity = task.comments && task.comments.length > 0 
      ? Math.max(...task.comments.map(c => c.createdAt))
      : task.createdAt;
      
    return now - lastActivity > 30000; // 30 seconds
  };

  // Load tasks from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const seen = new Set();
          const clean = parsed.filter(t => {
            if (seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
          });
          setTasks(clean);
        }
      } catch (e) {
        console.error('Failed to parse tasks', e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save tasks to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }
  }, [tasks, isLoaded]);

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    updateTasksState((prevTasks) => {
      const newTasks = [...prevTasks];
      const taskIndex = newTasks.findIndex((t) => t.id === draggableId);
      
      if (taskIndex === -1) return prevTasks;
      
      const [movedTask] = newTasks.splice(taskIndex, 1);
      const updatedTask = { ...movedTask, status: destination.droppableId as Status };
      
      // Find tasks in destination column to determine insertion point
      const destColumnTasks = newTasks.filter(t => t.status === destination.droppableId);
      
      let globalInsertIndex;
      if (destination.index < destColumnTasks.length) {
        const targetTask = destColumnTasks[destination.index];
        globalInsertIndex = newTasks.findIndex(t => t.id === targetTask.id);
      } else {
        // Append to the end of the column's group in the global array
        if (destColumnTasks.length > 0) {
          const lastTask = destColumnTasks[destColumnTasks.length - 1];
          globalInsertIndex = newTasks.findIndex(t => t.id === lastTask.id) + 1;
        } else {
          // If column is empty, just append to the end of the array
          globalInsertIndex = newTasks.length;
        }
      }
      
      newTasks.splice(globalInsertIndex, 0, updatedTask);
      return newTasks;
    });
  };

  const handleAddTask = () => {
    if (!newTask.title) return;

    const task: Task = {
      id: generateId(),
      title: newTask.title!,
      description: newTask.description || '',
      comments: newCommentText 
        ? [{ id: generateId(), text: newCommentText, createdAt: Date.now() }]
        : [],
      priority: (newTask.priority as any) || 'medium',
      status: (newTask.status as Status) || 'analise',
      createdAt: Date.now(),
    };

    updateTasksState(prev => [...prev, task]);
    setIsModalOpen(false);
    setNewTask({ title: '', description: '', priority: 'medium', status: 'analise' });
    setNewCommentText('');
  };

  const handleUpdateTask = () => {
    if (!editingTask || !editingTask.title) return;

    const updatedTask = { ...editingTask };
    if (newCommentText.trim()) {
      updatedTask.comments = [
        ...(updatedTask.comments || []),
        { id: generateId(), text: newCommentText.trim(), createdAt: Date.now() }
      ];
    }

    updateTasksState(prev => prev.map((t) => (t.id === editingTask.id ? updatedTask : t)));
    setEditingTask(null);
    setIsModalOpen(false);
    setNewCommentText('');
  };

  const deleteTask = (id: string) => {
    updateTasksState(prev => prev.filter((t) => t.id !== id));
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const moveTask = (id: string, newStatus: Status) => {
    updateTasksState(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
  };

  const priorityColors = {
    low: 'bg-blue-100 text-blue-800 border-blue-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-black pb-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter uppercase italic font-serif">
            Painel de Pendências
          </h1>
          <p className="text-sm opacity-60 font-mono mt-1">
            SISTEMA DE GERENCIAMENTO DE FLUXO // V1.0
          </p>
        </div>
        <button
          onClick={() => {
            setEditingTask(null);
            setNewTask({ title: '', description: '', priority: 'medium', status: 'analise' });
            setNewCommentText('');
            setIsModalOpen(true);
          }}
          className="bg-black text-[#E4E3E0] px-6 py-2 flex items-center gap-2 hover:bg-opacity-80 transition-all uppercase text-sm font-bold tracking-widest"
        >
          <Plus size={18} />
          Nova Pendência
        </button>
      </header>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {COLUMNS.map((column) => (
            <div key={column.id} className="flex flex-col min-h-[500px]">
              <div className="mb-4 flex items-center justify-between border-b border-black pb-2">
                <span className="col-header">{column.title}</span>
                <span className="font-mono text-[10px] opacity-40">
                  {tasks.filter((t) => t.status === column.id).length}
                </span>
              </div>

              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={cn(
                      "flex-1 transition-colors duration-200 rounded-sm p-2 min-h-[150px]",
                      snapshot.isDraggingOver ? "bg-black/5" : "bg-transparent"
                    )}
                  >
                      {tasks
                        .filter((t) => t.status === column.id)
                        .map((task, index) => (
                          <DraggableAny key={task.id} draggableId={task.id} index={index}>
                            {(provided: any, snapshot: any) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => openEditModal(task)}
                                className={cn(
                                  "mb-3 bg-white border border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all group cursor-pointer",
                                  snapshot.isDragging && "shadow-none translate-x-[2px] translate-y-[2px] rotate-2",
                                  isTaskAlerting(task) && "border-red-600 shadow-[4px_4px_0px_0px_rgba(220,38,38,1)] bg-red-50"
                                )}
                              >
                                {isTaskAlerting(task) && (
                                  <div className="flex items-center gap-1 text-red-600 text-[10px] font-bold uppercase mb-2 animate-pulse">
                                    <AlertCircle size={12} />
                                    Atenção: Sem comentários há mais de 30s
                                  </div>
                                )}
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing opacity-30 hover:opacity-100 transition-opacity">
                                      <GripVertical size={16} />
                                    </div>
                                    <span className={cn(
                                      "text-[10px] px-2 py-0.5 border border-black font-bold uppercase tracking-tighter",
                                      priorityColors[task.priority]
                                    )}>
                                      {task.priority}
                                    </span>
                                  </div>
                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="relative group/menu" onClick={(e) => e.stopPropagation()}>
                                      <button className="hover:text-black opacity-50 hover:opacity-100">
                                        <ArrowRightLeft size={14} />
                                      </button>
                                      <div className="absolute right-0 top-full mt-1 bg-white border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-10 hidden group-hover/menu:block min-w-[160px]">
                                        {COLUMNS.filter(c => c.id !== task.status).map(col => (
                                          <button
                                            key={col.id}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              moveTask(task.id, col.id);
                                            }}
                                            className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase hover:bg-black hover:text-white transition-colors border-b border-black last:border-0"
                                          >
                                            Mover para {col.title}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditModal(task);
                                      }} 
                                      className="hover:text-blue-600 opacity-50 hover:opacity-100"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteTask(task.id);
                                      }} 
                                      className="hover:text-red-600 opacity-50 hover:opacity-100"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                <h3 className="font-bold text-lg leading-tight mb-2 uppercase tracking-tight">
                                  {task.title}
                                </h3>
                                <p className="text-xs opacity-70 line-clamp-2 mb-2">
                                  {task.description}
                                </p>
                                {task.comments && task.comments.length > 0 && (
                                  <div className="mb-4 space-y-2">
                                    {task.comments.slice(-2).map((comment) => (
                                      <div key={comment.id} className="p-2 bg-black/5 border-l-2 border-black text-[10px] italic opacity-80">
                                        "{comment.text}"
                                      </div>
                                    ))}
                                    {task.comments.length > 2 && (
                                      <p className="text-[9px] opacity-40 text-right">+ {task.comments.length - 2} comentários</p>
                                    )}
                                  </div>
                                )}
                                <div className="flex items-center justify-between mt-auto pt-3 border-t border-black/10">
                                  <div className="flex items-center gap-1 opacity-40 text-[10px] font-mono">
                                    <Clock size={10} />
                                    {format(task.createdAt, 'dd/MM/yy HH:mm')}
                                  </div>
                                  {task.status === 'externo' && <ExternalLink size={12} className="opacity-40" />}
                                </div>
                              </div>
                            )}
                          </DraggableAny>
                        ))}
                      {provided.placeholder}
                    </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#E4E3E0] border-2 border-black p-8 w-full max-w-lg shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
            >
              <div className="flex justify-between items-center mb-8 border-b border-black pb-4">
                <h2 className="text-2xl font-bold italic font-serif uppercase">
                  {editingTask ? 'Editar Pendência' : 'Nova Pendência'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="hover:rotate-90 transition-transform">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="col-header block mb-2">Título</label>
                  <input
                    type="text"
                    value={editingTask ? editingTask.title : newTask.title}
                    onChange={(e) => editingTask 
                      ? setEditingTask({ ...editingTask, title: e.target.value })
                      : setNewTask({ ...newTask, title: e.target.value })
                    }
                    className="w-full bg-white border border-black p-3 font-mono focus:outline-none focus:ring-2 focus:ring-black/5"
                    placeholder="Ex: Resolver bug no login"
                  />
                </div>

                <div>
                  <label className="col-header block mb-2">Descrição</label>
                  <textarea
                    value={editingTask ? editingTask.description : newTask.description}
                    onChange={(e) => editingTask 
                      ? setEditingTask({ ...editingTask, description: e.target.value })
                      : setNewTask({ ...newTask, description: e.target.value })
                    }
                    className="w-full bg-white border border-black p-3 font-mono focus:outline-none focus:ring-2 focus:ring-black/5 min-h-[80px]"
                    placeholder="Detalhes da pendência..."
                  />
                </div>

                <div>
                  <label className="col-header block mb-2">Comentários / Observações</label>
                  
                  {editingTask && editingTask.comments && editingTask.comments.length > 0 && (
                    <div className="mb-4 max-h-[150px] overflow-y-auto space-y-2 border-b border-black/10 pb-4">
                      {editingTask.comments.map((comment) => (
                        <div key={comment.id} className="text-[11px] bg-white p-2 border border-black/5">
                          <div className="flex justify-between opacity-40 mb-1 text-[9px] font-mono">
                            <span>REGISTRO</span>
                            <span>{format(comment.createdAt, 'dd/MM HH:mm')}</span>
                          </div>
                          <p className="italic">"{comment.text}"</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <textarea
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="w-full bg-white border border-black p-3 font-mono focus:outline-none focus:ring-2 focus:ring-black/5 min-h-[60px]"
                    placeholder={editingTask ? "Adicionar novo comentário..." : "Alguma observação inicial?"}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="col-header block mb-2">Prioridade</label>
                    <select
                      value={editingTask ? editingTask.priority : newTask.priority}
                      onChange={(e) => editingTask 
                        ? setEditingTask({ ...editingTask, priority: e.target.value as any })
                        : setNewTask({ ...newTask, priority: e.target.value as any })
                      }
                      className="w-full bg-white border border-black p-3 font-mono focus:outline-none"
                    >
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                    </select>
                  </div>
                  <div>
                    <label className="col-header block mb-2">Status Inicial</label>
                    <select
                      value={editingTask ? editingTask.status : newTask.status}
                      onChange={(e) => editingTask 
                        ? setEditingTask({ ...editingTask, status: e.target.value as Status })
                        : setNewTask({ ...newTask, status: e.target.value as Status })
                      }
                      className="w-full bg-white border border-black p-3 font-mono focus:outline-none"
                    >
                      {COLUMNS.map(col => (
                        <option key={col.id} value={col.id}>{col.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <button
                    onClick={editingTask ? handleUpdateTask : handleAddTask}
                    className="flex-1 bg-black text-[#E4E3E0] py-4 font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    <Check size={20} />
                    {editingTask ? 'Salvar Alterações' : 'Criar Pendência'}
                  </button>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 border border-black py-4 font-bold uppercase tracking-widest hover:bg-black hover:text-[#E4E3E0] transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 opacity-20">
          <AlertCircle size={64} strokeWidth={1} />
          <p className="mt-4 font-serif italic text-xl">Nenhuma pendência registrada.</p>
        </div>
      )}
    </div>
  );
}
