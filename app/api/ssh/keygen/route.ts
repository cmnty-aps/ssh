import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function encodeSshString(buf: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(buf.length, 0);
  return Buffer.concat([len, buf]);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const algorithm = body.algorithm === 'rsa-4096' ? 'rsa-4096' : 'ed25519';
    const comment = String(body.comment || 'operator@termius-workspace').trim();

    if (algorithm === 'ed25519') {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      // Extract raw 32-byte Ed25519 public key from ASN.1 SPKI DER (last 32 bytes)
      const rawPubKey = publicKey.subarray(publicKey.length - 32);
      const keyType = Buffer.from('ssh-ed25519', 'utf8');
      const wireBlob = Buffer.concat([encodeSshString(keyType), encodeSshString(rawPubKey)]);
      const base64Wire = wireBlob.toString('base64');
      const fingerprintHash = crypto
        .createHash('sha256')
        .update(wireBlob)
        .digest('base64')
        .replace(/=+$/, '');

      return NextResponse.json({
        algorithm: 'Ed25519',
        bits: 256,
        publicKey: `ssh-ed25519 ${base64Wire} ${comment}`,
        privateKey,
        fingerprint: `SHA256:${fingerprintHash}`,
      });
    } else {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const pubKeyObj = crypto.createPublicKey(publicKey);
      const jwk = pubKeyObj.export({ format: 'jwk' });
      const eBuf = Buffer.from(String(jwk.e), 'base64url');
      let nBuf = Buffer.from(String(jwk.n), 'base64url');
      if (nBuf[0] & 0x80) {
        nBuf = Buffer.concat([Buffer.from([0x00]), nBuf]);
      }

      const keyType = Buffer.from('ssh-rsa', 'utf8');
      const wireBlob = Buffer.concat([
        encodeSshString(keyType),
        encodeSshString(eBuf),
        encodeSshString(nBuf),
      ]);
      const base64Wire = wireBlob.toString('base64');
      const fingerprintHash = crypto
        .createHash('sha256')
        .update(wireBlob)
        .digest('base64')
        .replace(/=+$/, '');

      return NextResponse.json({
        algorithm: 'RSA',
        bits: 4096,
        publicKey: `ssh-rsa ${base64Wire} ${comment}`,
        privateKey,
        fingerprint: `SHA256:${fingerprintHash}`,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Key generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
