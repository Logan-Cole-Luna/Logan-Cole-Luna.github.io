/* Data for js/anim-dqn.js (Hierarchical Dueling Deep Q-Learning for Intrusion Detection).
   Real numbers come from github.com/Logan-Cole-Luna/Hierarchical-Q-Learning-Threat-Hunting:
     results/binary_classification/binary_classification_report.csv
     results/multi_class_classification/rl_classification_report.csv
     results/multi_class_classification/rl_confusion_matrix.png (counts)
     results/*_shap_summary.png (mean |SHAP|, read off the saved bar charts)
     utils/q_network.py (40 -> 128 -> 64, value head 1, advantage head 5)
   The "flows" list is ILLUSTRATIVE: hand-made example flows that use the repo's real
   class and feature names. Their packets, feature values and Q-values are not dataset rows or model outputs. */
window.DQN_DATA = {
  total: 2177804,                         // flows evaluated by the high-level agent
  binaryAccuracy: 0.99977,
  multiAccuracy: 0.99684,
  net: { input: 40, hidden: [128, 64], actions: 5 },

  // high-level agent (XGBoost): benign vs malicious
  benign: { name: "Benign", support: 1935399, recall: 0.99996 },
  // low-level agent (dueling DQN) on the 242,405 malicious flows; order = action index
  classes: [
    { name: "Botnet",      support: 28907,  recall: 0.98862 },
    { name: "Brute-force", support: 18820,  recall: 0.99915 },
    { name: "DDoS attack", support: 155191, recall: 1.00000 },
    { name: "DoS attack",  support: 39314,  recall: 0.99372 },
    { name: "Web attack",  support: 173,    recall: 0.00000 }   // 112 of 173 predicted DDoS attack, 60 Botnet, 1 DoS
  ],

  // the top two features by mean |SHAP| for each agent; the flow line shows the first of each
  features: [
    { name: "Init Fwd Win Byts", stage: 1, shap: 3.19 },
    { name: "Init Bwd Win Byts", stage: 1, shap: 2.67 },
    { name: "RST Flag Cnt",      stage: 2, shap: 0.047 },
    { name: "PSH Flag Cnt",      stage: 2, shap: 0.038 }
  ],

  // ILLUSTRATIVE flows. Hand-made, not dataset rows (the repo ships its CSV column list in
  // scripts/preprocess.py but no data). Values sit in typical CIC-IDS2018 ranges for each class and
  // stay consistent with one another:
  //   v      = values of the four features above (the figure reads off v[0], v[2] and v[3])
  //   fwd    = Tot Fwd Pkts, bwd = Tot Bwd Pkts, dur = Flow Duration (microseconds)
  //   pk     = the packets in arrival order: "f"/"b" for direction, then flag letters
  //            (S = SYN, P = PSH, R = RST). The number of P and R marks equals PSH Flag Cnt (v[3])
  //            and RST Flag Cnt (v[2]); the count of f and b equals fwd and bwd. Init Fwd Win Byts
  //            is read off the first forward packet. Packet spacing in the figure is illustrative.
  //   label  = true class, pred = routed class (-1 = benign)
  //   V, A   = illustrative value and advantage outputs; Q = V + A - mean(A), highest Q wins.
  flows: [
    { id: "0412", proto: "TCP", port: 443,  v: [65535, 29200, 0, 1], fwd: 6, bwd: 5, dur: 1032409,
      pk: ["fS", "b", "f", "fP", "b", "b", "f", "b", "f", "b", "f"], label: -1, pred: -1 },
    { id: "0413", proto: "TCP", port: 80,   v: [8192, 211, 0, 1],    fwd: 4, bwd: 3, dur: 6011,
      pk: ["fS", "b", "f", "fP", "b", "f", "b"], label: 2, pred: 2,
      V: 1.35, A: [-0.6, -1.1, 1.9, 0.4, -0.3] },
    { id: "0417", proto: "TCP", port: 80,   v: [225, 211, 0, 1],     fwd: 5, bwd: 4, dur: 9374,
      pk: ["fS", "b", "f", "b", "fP", "b", "f", "b", "f"], label: 3, pred: 3,
      V: 1.2, A: [-0.7, -0.2, 0.5, 1.7, -0.9] },
    { id: "0421", proto: "UDP", port: 53,   v: [-1, -1, 0, 0],       fwd: 1, bwd: 1, dur: 395,
      pk: ["f", "b"], label: -1, pred: -1 },          // UDP: no TCP window, so Init Fwd Win Byts is -1
    { id: "0426", proto: "TCP", port: 8080, v: [8192, 237, 1, 1],    fwd: 4, bwd: 3, dur: 10812,
      pk: ["fS", "b", "fP", "f", "b", "f", "bR"], label: 0, pred: 0,
      V: 1.1, A: [1.6, -0.9, 0.3, -0.5, -0.4] },
    { id: "0430", proto: "TCP", port: 21,   v: [26883, -1, 1, 0],    fwd: 2, bwd: 0, dur: 3,
      pk: ["fS", "fR"], label: 1, pred: 1,            // no backward packet, so Init Bwd Win Byts is -1
      V: 1.3, A: [-0.8, 1.8, -0.6, 0.6, -0.5] },
    { id: "0438", proto: "TCP", port: 80,   v: [8192, 237, 0, 1],    fwd: 8, bwd: 6, dur: 5021664,
      pk: ["fS", "b", "f", "b", "fP", "b", "f", "b", "f", "b", "f", "b", "f", "f"], label: 4, pred: 2,
      V: 0.9, A: [0.6, -1.0, 1.2, -0.4, 1.0] }   // a miss, as most test Web attack flows were:
                                                // DDoS attack narrowly beats Web attack
  ]
};
