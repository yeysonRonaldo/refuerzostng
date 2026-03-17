import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { Users, Plus, Trash2, Loader2, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';

interface AppUser {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  displayName?: string;
}

const getRolesCollection = () => collection(db, 'refuezo', 'public', 'roles');

export default function UserManagement() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(getRolesCollection());
      const list: AppUser[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          uid: d.id,
          email: String(data.email || ''),
          role: data.role === 'admin' ? 'admin' : 'user',
          displayName: String(data.displayName || ''),
        });
      });
      setUsers(list);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      // We store by email as doc ID (sanitized) since we don't know UID yet
      // When they log in, AuthContext will check by email or UID
      const docId = newEmail.trim().toLowerCase().replace(/[.@]/g, '_');
      await setDoc(doc(db, 'refuezo', 'public', 'roles', docId), {
        email: newEmail.trim().toLowerCase(),
        role: newRole,
        displayName: '',
        createdAt: new Date().toISOString(),
      });
      toast.success(`Usuario ${newEmail} agregado como ${newRole}.`);
      setNewEmail('');
      await loadUsers();
    } catch (err) {
      console.error(err);
      toast.error('Error al agregar usuario.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveUser = async (user: AppUser) => {
    if (!confirm(`¿Eliminar acceso de ${user.email}?`)) return;
    try {
      await deleteDoc(doc(db, 'refuezo', 'public', 'roles', user.uid));
      toast.success(`Acceso de ${user.email} eliminado.`);
      await loadUsers();
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar usuario.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p>Solo administradores pueden gestionar usuarios.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-6 h-6 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Gestión de Usuarios</h2>
      </div>

      {/* Add user form */}
      <form onSubmit={handleAddUser} className="bg-card border border-border rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Agregar Usuario
        </h3>
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            required
            className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
            className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
          >
            <option value="user">Usuario</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={adding}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Agregar
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          El usuario debe tener una cuenta en Firebase Auth. Si no la tiene, créala desde la consola de Firebase.
        </p>
      </form>

      {/* User list */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Usuarios con Acceso ({users.length})
          </h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
          </div>
        ) : users.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            No hay usuarios registrados aún.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.uid} className="flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {u.role === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveUser(u)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/10"
                  title="Eliminar acceso"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
